# Rank Diary

Diário de partidas ranqueadas de Valorant feito em React Native com Expo.
O jogador cria uma conta, registra as partidas (mapa, agente, resultado,
K/D/A e placar), acompanha as estatísticas e vê em tempo real quais amigos
estão disponíveis para jogar.

Projeto individual da disciplina **CCP150 – Desenvolvimento de Aplicativos
Móveis** (FEI).

## Funcionalidades

- **Login e cadastro** com e-mail e senha (Firebase Authentication)
- **CRUD de partidas** salvo no Cloud Firestore
  - registrar, listar, ver detalhes, editar e excluir
- **Atualização em tempo real**: as telas mudam sozinhas quando o banco muda
- **Estatísticas**: win rate geral, K/D médio e win rate por mapa e por agente
- **Amigos online**: lista de jogadores do app com status de disponível,
  atualizada em tempo real (o celular vibra quando alguém fica disponível)
- **Perfil**: agente mais jogado, melhor mapa e total de partidas
- Feedback por **vibração** (vitória, derrota, erro, convite)

## Telas

| Tela | O que faz |
| --- | --- |
| Login / Criar conta | Autenticação com e-mail e senha |
| Início | Resumo de vitórias/derrotas e última partida |
| Registrar partida | Cria ou edita uma partida |
| Histórico | Lista de todas as partidas |
| Detalhes | Dados da partida, com editar e excluir |
| Estatísticas | Win rate e K/D por mapa e por agente |
| Amigos | Jogadores online e chave "Disponível para jogar" |
| Perfil | Dados do jogador e botão de sair |

## Tecnologias

- [Expo](https://expo.dev) SDK 58 e React Native 0.88
- React Navigation 7 (native stack e bottom tabs)
- Firebase 13: Authentication e Cloud Firestore
- `@expo/vector-icons` (Ionicons)

## Como funciona

- **Login**: o `App` escuta o Firebase Auth com `onAuthStateChanged`.
  Sem usuário, mostra Login e Cadastro; com usuário, mostra as abas do app.
  Por isso o app troca de tela sozinho depois de entrar ou sair.
- **AppProvider (Context)**: estado global com o perfil, as partidas e as
  funções do CRUD. Qualquer tela acessa com `useContext(AppContext)`.
- **Leitura em tempo real**: o `AppProvider` usa `onSnapshot` no perfil e nas
  partidas do usuário (ordenadas por `criadoEm`).
- **Escrita**: `addDoc` (criar), `updateDoc` (editar) e `deleteDoc` (excluir).
  Depois de cada escrita o `onSnapshot` atualiza a lista automaticamente.

### Estrutura no Firestore

```
usuarios/{uid}                 -> { nick, rank, disponivel }
usuarios/{uid}/partidas/{id}   -> { mapa, agente, resultado, kills, deaths,
                                    assists, placar, data, criadoEm }
```

## Como rodar

Pré-requisitos: [Node.js](https://nodejs.org) e o app **Expo Go** (SDK 58)
no celular.

```bash
npm install
npx expo login
npx expo start
```

- **Celular**: abra o Expo Go logado na mesma conta Expo do computador e
  toque no projeto em *Development servers* (ou escaneie o QR code).
  Celular e computador precisam estar no mesmo Wi-Fi.
  Se a rede bloquear a conexão, use `npx expo start --tunnel`.
- **Navegador**: aperte `w` no terminal ou rode `npx expo start --web`.
  Na versão web a vibração e os alertas de confirmação não funcionam.

## Configuração do Firebase

O app usa o projeto definido em `firebaseConfig.js`. Para usar outro projeto,
troque as credenciais nesse arquivo e, no Console do Firebase:

1. Em **Authentication → Método de login**, ative **E-mail/senha**.
2. Em **Firestore Database**, crie o banco `(default)`.
3. Na aba **Regras**, publique:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;

      match /partidas/{partidaId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

Qualquer usuário logado vê a lista de jogadores (tela Amigos), mas só o dono
altera o próprio perfil e as próprias partidas.

## Estrutura do projeto

```
App.js             telas, navegação, Context e acesso ao Firestore
firebaseConfig.js  inicialização do Firebase (auth e db)
metro.config.js    ajuste do Metro para o Firebase funcionar no celular
assets/            ícones, fotos dos mapas e foto de perfil
```

O `metro.config.js` faz o Metro resolver os pacotes do Firebase sempre do
mesmo jeito. Sem ele, o app carrega duas cópias do Firebase e o login quebra
no celular com o erro *"Component auth has not been registered yet"*.

## Autor

Gustavo Nomura – [@guganomura](https://github.com/guganomura)
