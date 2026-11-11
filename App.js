import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  ScrollView,
  Switch,
  Alert,
  Vibration,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

/* ============================================================
   CONSTANTES
   ============================================================ */

const CORES = {
  fundo: '#0F1923',
  card: '#1C2733',
  borda: '#2A3A4A',
  vermelho: '#FF4655',
  verde: '#2ECC71',
  amarelo: '#F5C542',
  texto: '#ECE8E1',
  cinza: '#8B978F',
};

const MAPAS = ['Ascent', 'Bind', 'Haven', 'Lotus', 'Split', 'Sunset', 'Icebox'];
const AGENTES = ['Jett', 'Reyna', 'Raze', 'Sova', 'Omen', 'Viper', 'Killjoy', 'Sage'];

// Foto de perfil (arquivo em assets/)
const FOTO_PERFIL = require('./assets/perfil.png');

// Fotos dos mapas: adicione uma linha para cada foto que estiver em assets/
const IMAGENS_MAPAS = {
  Ascent: require('./assets/ascent.png'),
  Bind: require('./assets/bind.png'),
  Haven: require('./assets/haven.png'),
  Icebox: require('./assets/icebox.png'),
  Lotus: require('./assets/lotus.png'),
  Split: require('./assets/split.png'),
  Sunset: require('./assets/sunset.png'),
};

// Se o mapa não tiver foto, usa uma imagem provisória
const imagemMapa = (mapa) =>
  IMAGENS_MAPAS[mapa] ?? { uri: `https://picsum.photos/seed/${mapa}/600/300` };

const imagemAvatar = (nome) => ({ uri: `https://picsum.photos/seed/avatar-${nome}/200/200` });

const COR_STATUS = { online: CORES.verde, offline: CORES.cinza };

// Traduz os códigos de erro do Firebase Auth
const MENSAGENS_ERRO = {
  'auth/invalid-email': 'E-mail inválido.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/missing-password': 'Digite a senha.',
};

const mensagemErro = (erro) => MENSAGENS_ERRO[erro.code] ?? 'Algo deu errado. Tente novamente.';

/* ============================================================
   ESTADO GLOBAL (Context) — dados do Firestore
   Estrutura no banco:
     usuarios/{uid}                -> { nick, rank, disponivel }
     usuarios/{uid}/partidas/{id}  -> { mapa, agente, resultado, ... }
   ============================================================ */

const AppContext = createContext();

function AppProvider({ usuario, children }) {
  const [perfil, setPerfil] = useState(null);
  const [partidas, setPartidas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const partidasRef = collection(db, 'usuarios', usuario.uid, 'partidas');
  const perfilRef = doc(db, 'usuarios', usuario.uid);

  // READ: escuta em tempo real o perfil e as partidas do usuário logado
  useEffect(() => {
    const pararPerfil = onSnapshot(perfilRef, (snap) => setPerfil(snap.data() ?? null));

    const consulta = query(partidasRef, orderBy('criadoEm', 'desc'));
    const pararPartidas = onSnapshot(consulta, (snap) => {
      setPartidas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    });

    return () => {
      pararPerfil();
      pararPartidas();
    };
  }, [usuario.uid]);

  // CREATE
  const adicionar = (dados) => addDoc(partidasRef, { ...dados, criadoEm: Date.now() });
  // UPDATE
  const atualizar = (id, dados) => updateDoc(doc(partidasRef, id), dados);
  // DELETE
  const remover = (id) => deleteDoc(doc(partidasRef, id));

  const alternarDisponivel = (valor) => updateDoc(perfilRef, { disponivel: valor });

  return (
    <AppContext.Provider
      value={{ usuario, perfil, partidas, carregando, adicionar, atualizar, remover, alternarDisponivel }}>
      {children}
    </AppContext.Provider>
  );
}

/* ============================================================
   FUNÇÕES AUXILIARES
   ============================================================ */

const calcularKD = (kills, deaths) => (deaths === 0 ? kills : kills / deaths).toFixed(2);

// Agrupa partidas por 'mapa' ou 'agente' e calcula a taxa de vitória
function agrupar(partidas, campo) {
  const grupos = {};
  partidas.forEach((p) => {
    const g = grupos[p[campo]] || { total: 0, vitorias: 0 };
    g.total += 1;
    if (p.resultado === 'Vitória') g.vitorias += 1;
    grupos[p[campo]] = g;
  });
  return Object.entries(grupos)
    .map(([nome, g]) => ({ nome, total: g.total, taxa: Math.round((g.vitorias / g.total) * 100) }))
    .sort((a, b) => b.taxa - a.taxa);
}

/* ============================================================
   COMPONENTES REUTILIZÁVEIS
   ============================================================ */

function Carregando() {
  return (
    <View style={[styles.tela, styles.centro]}>
      <ActivityIndicator size="large" color={CORES.vermelho} />
    </View>
  );
}

function CardPartida({ partida, onPress }) {
  const venceu = partida.resultado === 'Vitória';
  return (
    <TouchableOpacity style={styles.cardPartida} onPress={onPress} activeOpacity={0.8}>
      <Image source={imagemMapa(partida.mapa)} style={styles.miniatura} />
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitulo}>{partida.mapa}</Text>
        <Text style={styles.cardSub}>
          {partida.agente} • {partida.kills}/{partida.deaths}/{partida.assists} • {partida.data}
        </Text>
      </View>
      <View style={[styles.tag, { backgroundColor: venceu ? CORES.verde : CORES.vermelho }]}>
        <Text style={styles.tagTexto}>{partida.placar}</Text>
      </View>
    </TouchableOpacity>
  );
}

function Resumo({ label, valor, cor }) {
  return (
    <View style={styles.resumo}>
      <Text style={[styles.resumoValor, { color: cor }]}>{valor}</Text>
      <Text style={styles.resumoLabel}>{label}</Text>
    </View>
  );
}

function Chips({ opcoes, selecionado, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
      {opcoes.map((op) => {
        const ativo = op === selecionado;
        return (
          <TouchableOpacity
            key={op}
            onPress={() => onSelect(op)}
            style={[styles.chip, ativo && styles.chipAtivo]}>
            <Text style={[styles.chipTexto, ativo && { color: '#fff' }]}>{op}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function Campo({ label, ...props }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={CORES.cinza} {...props} />
    </View>
  );
}

function BarraTaxa({ nome, taxa, total }) {
  const cor = taxa >= 50 ? CORES.verde : CORES.vermelho;
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={styles.linhaEntre}>
        <Text style={styles.textoNormal}>{nome}</Text>
        <Text style={styles.cardSub}>
          {taxa}% • {total} {total === 1 ? 'partida' : 'partidas'}
        </Text>
      </View>
      <View style={styles.barraFundo}>
        <View style={[styles.barraPreenchida, { width: `${taxa}%`, backgroundColor: cor }]} />
      </View>
    </View>
  );
}

/* ============================================================
   TELA — LOGIN
   ============================================================ */

function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async () => {
    setEnviando(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      Vibration.vibrate(50); // login OK
      // Não precisa navegar: o onAuthStateChanged troca para as telas do app
    } catch (erro) {
      Vibration.vibrate(300); // vibração longa = erro
      Alert.alert('Não foi possível entrar', mensagemErro(erro));
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.tela, styles.centro, { padding: 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Ionicons name="trophy" size={56} color={CORES.vermelho} />
      <Text style={styles.logo}>RANK DIARY</Text>
      <Text style={[styles.cardSub, { marginBottom: 32 }]}>Seu diário de ranqueadas</Text>

      <View style={{ width: '100%' }}>
        <Campo
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="voce@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Campo label="Senha" value={senha} onChangeText={setSenha} placeholder="••••••" secureTextEntry />

        <TouchableOpacity style={[styles.botao, { marginTop: 12 }]} onPress={entrar} disabled={enviando}>
          {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.textoBotao}>Entrar</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Cadastro')}>
          <Text style={styles.link}>
            Não tem conta? <Text style={{ color: CORES.vermelho }}>Criar conta</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ============================================================
   TELA — CADASTRO
   ============================================================ */

function CadastroScreen() {
  const [nick, setNick] = useState('');
  const [rank, setRank] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cadastrar = async () => {
    if (!nick.trim()) {
      Alert.alert('Campo obrigatório', 'Digite seu Riot ID (ex: Gustavo#FEI).');
      return;
    }
    setEnviando(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);
      // Cria o documento do perfil no Firestore com o mesmo id do usuário
      await setDoc(doc(db, 'usuarios', cred.user.uid), {
        nick: nick.trim(),
        rank: rank.trim() || 'Sem rank',
        disponivel: false,
      });
      Vibration.vibrate(80);
    } catch (erro) {
      Vibration.vibrate(300);
      Alert.alert('Não foi possível cadastrar', mensagemErro(erro));
      setEnviando(false);
    }
  };

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Campo label="Riot ID" value={nick} onChangeText={setNick} placeholder="Gustavo#FEI" />
      <Campo label="Rank atual" value={rank} onChangeText={setRank} placeholder="Radiante #22" />
      <Campo
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        placeholder="voce@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Campo label="Senha" value={senha} onChangeText={setSenha} placeholder="Mínimo 6 caracteres" secureTextEntry />

      <TouchableOpacity style={[styles.botao, { marginTop: 12 }]} onPress={cadastrar} disabled={enviando}>
        {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.textoBotao}>Criar conta</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ============================================================
   TELA 1 — INÍCIO
   ============================================================ */

function InicioScreen({ navigation }) {
  const { perfil, partidas, carregando } = useContext(AppContext);
  if (carregando) return <Carregando />;

  const vitorias = partidas.filter((p) => p.resultado === 'Vitória').length;
  const ultima = partidas[0];

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <View style={styles.cabecalho}>
        <Image source={FOTO_PERFIL} style={styles.avatarPequeno} />
        <View>
          <Text style={styles.cardSub}>Bem-vindo de volta</Text>
          <Text style={styles.titulo}>{perfil?.nick ?? '...'}</Text>
        </View>
      </View>

      <View style={styles.linhaResumo}>
        <Resumo label="Vitórias" valor={vitorias} cor={CORES.verde} />
        <Resumo label="Derrotas" valor={partidas.length - vitorias} cor={CORES.vermelho} />
        <Resumo label="Partidas" valor={partidas.length} cor={CORES.texto} />
      </View>

      <TouchableOpacity style={styles.botao} onPress={() => navigation.navigate('Registrar')}>
        <Ionicons name="add-circle" size={20} color="#fff" />
        <Text style={styles.textoBotao}>Registrar partida</Text>
      </TouchableOpacity>

      <Text style={styles.secao}>Última partida</Text>
      {ultima ? (
        <CardPartida partida={ultima} onPress={() => navigation.navigate('Detalhe', { id: ultima.id })} />
      ) : (
        <Text style={styles.vazio}>Nenhuma partida registrada ainda.</Text>
      )}
    </ScrollView>
  );
}

/* ============================================================
   TELA 2 — REGISTRAR / EDITAR PARTIDA (Create / Update)
   ============================================================ */

function RegistrarScreen({ navigation, route }) {
  const { adicionar, atualizar } = useContext(AppContext);
  const editando = route.params?.partida; // se vier uma partida, estamos editando

  const [mapa, setMapa] = useState(editando?.mapa ?? MAPAS[0]);
  const [agente, setAgente] = useState(editando?.agente ?? AGENTES[0]);
  const [resultado, setResultado] = useState(editando?.resultado ?? 'Vitória');
  const [kills, setKills] = useState(editando ? String(editando.kills) : '');
  const [deaths, setDeaths] = useState(editando ? String(editando.deaths) : '');
  const [assists, setAssists] = useState(editando ? String(editando.assists) : '');
  const [placar, setPlacar] = useState(editando?.placar ?? '');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const numeros = [kills, deaths, assists];
    if (numeros.some((n) => n === '' || isNaN(Number(n)))) {
      Vibration.vibrate(300);
      Alert.alert('Campos inválidos', 'Preencha Kills, Deaths e Assists com números.');
      return;
    }

    const dados = {
      mapa,
      agente,
      resultado,
      kills: Number(kills),
      deaths: Number(deaths),
      assists: Number(assists),
      placar: placar || '-',
      data: editando?.data ?? new Date().toLocaleDateString('pt-BR').slice(0, 5),
    };

    setSalvando(true);
    try {
      if (editando) await atualizar(editando.id, dados);
      else await adicionar(dados);

      // Vibração diferente para vitória (dois toques) e derrota (um toque)
      Vibration.vibrate(resultado === 'Vitória' ? [0, 80, 60, 80] : 150);
      navigation.goBack();
    } catch (erro) {
      Alert.alert('Erro ao salvar', 'Verifique sua conexão e tente novamente.');
      setSalvando(false);
    }
  };

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Image source={imagemMapa(mapa)} style={styles.banner} />

      <Text style={styles.label}>Mapa</Text>
      <Chips opcoes={MAPAS} selecionado={mapa} onSelect={setMapa} />

      <Text style={styles.label}>Agente</Text>
      <Chips opcoes={AGENTES} selecionado={agente} onSelect={setAgente} />

      <Text style={styles.label}>Resultado</Text>
      <View style={[styles.linha, { marginBottom: 16 }]}>
        {['Vitória', 'Derrota'].map((r) => {
          const ativo = r === resultado;
          const cor = r === 'Vitória' ? CORES.verde : CORES.vermelho;
          return (
            <TouchableOpacity
              key={r}
              onPress={() => setResultado(r)}
              style={[styles.botaoResultado, ativo && { backgroundColor: cor, borderColor: cor }]}>
              <Text style={[styles.chipTexto, ativo && { color: '#fff' }]}>{r}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.linha}>
        <Campo label="Kills" value={kills} onChangeText={setKills} keyboardType="numeric" placeholder="0" />
        <Campo label="Deaths" value={deaths} onChangeText={setDeaths} keyboardType="numeric" placeholder="0" />
        <Campo label="Assists" value={assists} onChangeText={setAssists} keyboardType="numeric" placeholder="0" />
      </View>

      <Campo label="Placar" value={placar} onChangeText={setPlacar} placeholder="13-9" />

      <TouchableOpacity style={[styles.botao, { marginTop: 24 }]} onPress={salvar} disabled={salvando}>
        {salvando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="save" size={20} color="#fff" />
            <Text style={styles.textoBotao}>{editando ? 'Salvar alterações' : 'Salvar partida'}</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ============================================================
   TELA 3 — HISTÓRICO (Read)
   ============================================================ */

function HistoricoScreen({ navigation }) {
  const { partidas, carregando } = useContext(AppContext);
  if (carregando) return <Carregando />;

  return (
    <FlatList
      style={styles.tela}
      contentContainerStyle={styles.conteudo}
      data={partidas}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <CardPartida partida={item} onPress={() => navigation.navigate('Detalhe', { id: item.id })} />
      )}
      ListEmptyComponent={<Text style={styles.vazio}>Nenhuma partida registrada ainda.</Text>}
    />
  );
}

/* ============================================================
   TELA 4 — DETALHE DA PARTIDA (Update / Delete)
   ============================================================ */

function DetalheScreen({ route, navigation }) {
  const { partidas, remover } = useContext(AppContext);
  const partida = partidas.find((p) => p.id === route.params.id);

  if (!partida) return <View style={styles.tela} />;

  const venceu = partida.resultado === 'Vitória';

  const excluir = () => {
    Alert.alert('Excluir partida', 'Tem certeza que deseja excluir esta partida?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          navigation.goBack();
          await remover(partida.id);
          Vibration.vibrate(200);
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Image source={imagemMapa(partida.mapa)} style={styles.banner} />

      <View style={styles.linhaEntre}>
        <Text style={styles.titulo}>{partida.mapa}</Text>
        <View style={[styles.tag, { backgroundColor: venceu ? CORES.verde : CORES.vermelho }]}>
          <Text style={styles.tagTexto}>{partida.resultado}</Text>
        </View>
      </View>
      <Text style={[styles.cardSub, { marginBottom: 16 }]}>
        {partida.agente} • {partida.data} • Placar {partida.placar}
      </Text>

      <View style={styles.linhaResumo}>
        <Resumo label="Kills" valor={partida.kills} cor={CORES.texto} />
        <Resumo label="Deaths" valor={partida.deaths} cor={CORES.texto} />
        <Resumo label="Assists" valor={partida.assists} cor={CORES.texto} />
        <Resumo label="K/D" valor={calcularKD(partida.kills, partida.deaths)} cor={CORES.vermelho} />
      </View>

      <TouchableOpacity style={styles.botao} onPress={() => navigation.navigate('Registrar', { partida })}>
        <Ionicons name="create" size={20} color="#fff" />
        <Text style={styles.textoBotao}>Editar</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.botao, styles.botaoSecundario]} onPress={excluir}>
        <Ionicons name="trash" size={20} color={CORES.vermelho} />
        <Text style={[styles.textoBotao, { color: CORES.vermelho }]}>Excluir</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ============================================================
   TELA 5 — ESTATÍSTICAS
   ============================================================ */

function EstatisticasScreen() {
  const { partidas, carregando } = useContext(AppContext);
  if (carregando) return <Carregando />;

  if (partidas.length === 0) {
    return (
      <View style={[styles.tela, styles.conteudo]}>
        <Text style={styles.vazio}>Registre partidas para ver suas estatísticas.</Text>
      </View>
    );
  }

  const vitorias = partidas.filter((p) => p.resultado === 'Vitória').length;
  const totalKills = partidas.reduce((soma, p) => soma + p.kills, 0);
  const totalDeaths = partidas.reduce((soma, p) => soma + p.deaths, 0);

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <View style={styles.linhaResumo}>
        <Resumo label="Win rate" valor={`${Math.round((vitorias / partidas.length) * 100)}%`} cor={CORES.verde} />
        <Resumo label="K/D médio" valor={calcularKD(totalKills, totalDeaths)} cor={CORES.vermelho} />
        <Resumo label="Partidas" valor={partidas.length} cor={CORES.texto} />
      </View>

      <Text style={styles.secao}>Win rate por mapa</Text>
      <View style={styles.caixa}>
        {agrupar(partidas, 'mapa').map((g) => (
          <BarraTaxa key={g.nome} {...g} />
        ))}
      </View>

      <Text style={styles.secao}>Win rate por agente</Text>
      <View style={styles.caixa}>
        {agrupar(partidas, 'agente').map((g) => (
          <BarraTaxa key={g.nome} {...g} />
        ))}
      </View>
    </ScrollView>
  );
}

/* ============================================================
   TELA 6 — AMIGOS ONLINE (tempo real pelo Firestore)
   ============================================================ */

function AmigosScreen() {
  const { usuario, perfil, alternarDisponivel } = useContext(AppContext);
  const [amigos, setAmigos] = useState([]);
  const primeiraCarga = useRef(true);

  useEffect(() => {
    // Escuta todos os usuários do app em tempo real
    const parar = onSnapshot(collection(db, 'usuarios'), (snap) => {
      // Quando alguém fica disponível, o celular vibra (ignora a primeira leitura)
      if (!primeiraCarga.current) {
        snap.docChanges().forEach((mudanca) => {
          const ficouDisponivel = mudanca.type === 'modified' && mudanca.doc.data().disponivel;
          if (ficouDisponivel && mudanca.doc.id !== usuario.uid) {
            Vibration.vibrate([0, 150, 100, 150]);
          }
        });
      }
      primeiraCarga.current = false;

      const lista = snap.docs
        .filter((d) => d.id !== usuario.uid)
        .map((d) => ({ id: d.id, ...d.data(), status: d.data().disponivel ? 'online' : 'offline' }))
        .sort((a, b) => (a.status === b.status ? 0 : a.status === 'online' ? -1 : 1));
      setAmigos(lista);
    });
    return parar;
  }, [usuario.uid]);

  const disponivel = perfil?.disponivel ?? false;
  const qtdOnline = amigos.filter((a) => a.status === 'online').length;

  const mudarDisponivel = (valor) => {
    alternarDisponivel(valor);
    Vibration.vibrate(60);
  };

  const convidar = (amigo) => {
    Vibration.vibrate([0, 100, 80, 100]);
    Alert.alert('Convite enviado', `Você chamou ${amigo.nick} para jogar!`);
  };

  return (
    <FlatList
      style={styles.tela}
      contentContainerStyle={styles.conteudo}
      data={amigos}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <View style={[styles.caixa, styles.linhaEntre, { marginBottom: 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.textoNormal}>Disponível para jogar</Text>
              <Text style={styles.cardSub}>
                {disponivel ? 'Os outros jogadores veem que você está livre' : 'Você aparece como offline'}
              </Text>
            </View>
            <Switch
              value={disponivel}
              onValueChange={mudarDisponivel}
              trackColor={{ true: CORES.verde, false: CORES.borda }}
              thumbColor="#fff"
            />
          </View>
          <Text style={styles.secao}>{qtdOnline} jogador(es) online</Text>
        </>
      }
      ListEmptyComponent={<Text style={styles.vazio}>Nenhum outro jogador cadastrado ainda.</Text>}
      renderItem={({ item }) => (
        <View style={styles.cardPartida}>
          <View>
            <Image source={imagemAvatar(item.nick)} style={styles.avatarPequeno} />
            <View style={[styles.bolinha, { backgroundColor: COR_STATUS[item.status] }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitulo}>{item.nick}</Text>
            <Text style={styles.cardSub}>
              {item.rank} • <Text style={{ color: COR_STATUS[item.status] }}>{item.status}</Text>
            </Text>
          </View>
          {item.status === 'online' && (
            <TouchableOpacity style={styles.botaoPequeno} onPress={() => convidar(item)}>
              <Text style={styles.tagTexto}>Chamar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    />
  );
}

/* ============================================================
   TELA 7 — PERFIL
   ============================================================ */

function PerfilScreen() {
  const { perfil, partidas } = useContext(AppContext);
  const agentes = agrupar(partidas, 'agente').sort((a, b) => b.total - a.total);
  const mapas = agrupar(partidas, 'mapa');

  const sair = () => {
    Alert.alert('Sair', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

  return (
    <ScrollView style={styles.tela} contentContainerStyle={[styles.conteudo, { alignItems: 'center' }]}>
      <Image source={FOTO_PERFIL} style={styles.avatarGrande} />
      <Text style={styles.titulo}>{perfil?.nick ?? '...'}</Text>
      <Text style={[styles.cardSub, { marginBottom: 24 }]}>{perfil?.rank ?? ''}</Text>

      <View style={[styles.caixa, { width: '100%' }]}>
        <InfoPerfil icone="person" label="Agente mais jogado" valor={agentes[0]?.nome ?? '-'} />
        <InfoPerfil icone="map" label="Melhor mapa" valor={mapas[0]?.nome ?? '-'} />
        <InfoPerfil icone="game-controller" label="Partidas registradas" valor={partidas.length} />
      </View>

      <TouchableOpacity style={[styles.botao, styles.botaoSecundario, { width: '100%' }]} onPress={sair}>
        <Ionicons name="log-out" size={20} color={CORES.vermelho} />
        <Text style={[styles.textoBotao, { color: CORES.vermelho }]}>Sair</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoPerfil({ icone, label, valor }) {
  return (
    <View style={[styles.linhaEntre, { paddingVertical: 10 }]}>
      <View style={styles.linha}>
        <Ionicons name={icone} size={18} color={CORES.vermelho} />
        <Text style={styles.textoNormal}>{label}</Text>
      </View>
      <Text style={styles.cardTitulo}>{valor}</Text>
    </View>
  );
}

/* ============================================================
   NAVEGAÇÃO
   - Sem usuário logado: Stack com Login e Cadastro
   - Com usuário logado: Stack com as Abas + Registrar + Detalhe
   ============================================================ */

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ICONES = {
  Inicio: 'home',
  Historico: 'list',
  Estatisticas: 'stats-chart',
  Amigos: 'people',
  Perfil: 'person',
};

const opcoesCabecalho = {
  headerStyle: { backgroundColor: CORES.fundo },
  headerTintColor: CORES.texto,
  headerTitleStyle: { fontWeight: 'bold' },
};

function Abas() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...opcoesCabecalho,
        tabBarStyle: { backgroundColor: CORES.card, borderTopColor: CORES.borda },
        tabBarActiveTintColor: CORES.vermelho,
        tabBarInactiveTintColor: CORES.cinza,
        tabBarIcon: ({ color, size }) => <Ionicons name={ICONES[route.name]} size={size} color={color} />,
      })}>
      <Tab.Screen name="Inicio" component={InicioScreen} options={{ title: 'Início' }} />
      <Tab.Screen name="Historico" component={HistoricoScreen} options={{ title: 'Histórico' }} />
      <Tab.Screen name="Estatisticas" component={EstatisticasScreen} options={{ title: 'Estatísticas' }} />
      <Tab.Screen name="Amigos" component={AmigosScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  );
}

function RotasApp() {
  return (
    <Stack.Navigator screenOptions={opcoesCabecalho}>
      <Stack.Screen name="Main" component={Abas} options={{ headerShown: false }} />
      <Stack.Screen
        name="Registrar"
        component={RegistrarScreen}
        options={({ route }) => ({ title: route.params?.partida ? 'Editar partida' : 'Registrar partida' })}
      />
      <Stack.Screen name="Detalhe" component={DetalheScreen} options={{ title: 'Detalhes' }} />
    </Stack.Navigator>
  );
}

function RotasAuth() {
  return (
    <Stack.Navigator screenOptions={opcoesCabecalho}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Cadastro" component={CadastroScreen} options={{ title: 'Criar conta' }} />
    </Stack.Navigator>
  );
}

const tema = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: CORES.fundo, card: CORES.fundo, primary: CORES.vermelho },
};

export default function App() {
  // undefined = ainda verificando | null = deslogado | objeto = logado
  const [usuario, setUsuario] = useState(undefined);

  useEffect(() => {
    const parar = onAuthStateChanged(auth, setUsuario);
    return parar;
  }, []);

  if (usuario === undefined) return <Carregando />;

  return (
    <NavigationContainer theme={tema}>
      <StatusBar style="light" />
      {usuario ? (
        <AppProvider usuario={usuario}>
          <RotasApp />
        </AppProvider>
      ) : (
        <RotasAuth />
      )}
    </NavigationContainer>
  );
}

/* ============================================================
   ESTILOS
   ============================================================ */

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  centro: { justifyContent: 'center', alignItems: 'center' },
  conteudo: { padding: 16, paddingBottom: 32 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  logo: { color: CORES.texto, fontSize: 32, fontWeight: 'bold', letterSpacing: 2, marginTop: 12 },
  link: { color: CORES.cinza, textAlign: 'center', marginTop: 8 },
  titulo: { color: CORES.texto, fontSize: 22, fontWeight: 'bold' },
  secao: { color: CORES.texto, fontSize: 16, fontWeight: 'bold', marginTop: 8, marginBottom: 12 },
  textoNormal: { color: CORES.texto, fontSize: 15 },
  vazio: { color: CORES.cinza, textAlign: 'center', marginTop: 24 },
  label: { color: CORES.cinza, fontSize: 13, marginBottom: 6, textTransform: 'uppercase' },

  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linhaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linhaResumo: { flexDirection: 'row', gap: 10, marginBottom: 20 },

  resumo: {
    flex: 1,
    backgroundColor: CORES.card,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resumoValor: { fontSize: 22, fontWeight: 'bold' },
  resumoLabel: { color: CORES.cinza, fontSize: 12, marginTop: 4 },

  caixa: { backgroundColor: CORES.card, borderRadius: 12, padding: 16, marginBottom: 16 },

  cardPartida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CORES.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  miniatura: { width: 64, height: 48, borderRadius: 8 },
  cardTitulo: { color: CORES.texto, fontSize: 16, fontWeight: 'bold' },
  cardSub: { color: CORES.cinza, fontSize: 13, marginTop: 2 },

  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tagTexto: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  botao: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CORES.vermelho,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
    minHeight: 50,
  },
  botaoSecundario: { backgroundColor: 'transparent', borderWidth: 1, borderColor: CORES.vermelho },
  textoBotao: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  botaoPequeno: { backgroundColor: CORES.vermelho, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  botaoResultado: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.borda,
  },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CORES.borda,
    marginRight: 8,
  },
  chipAtivo: { backgroundColor: CORES.vermelho, borderColor: CORES.vermelho },
  chipTexto: { color: CORES.cinza, fontWeight: '600' },

  input: {
    backgroundColor: CORES.card,
    color: CORES.texto,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },

  banner: { width: '100%', height: 150, borderRadius: 12, marginBottom: 16 },
  avatarPequeno: { width: 44, height: 44, borderRadius: 22 },
  avatarGrande: { width: 110, height: 110, borderRadius: 55, marginBottom: 12, borderWidth: 3, borderColor: CORES.vermelho },
  bolinha: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: CORES.card,
  },

  barraFundo: { height: 8, backgroundColor: CORES.borda, borderRadius: 4, marginTop: 6, overflow: 'hidden' },
  barraPreenchida: { height: '100%', borderRadius: 4 },
});
