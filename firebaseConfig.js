import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Credenciais do projeto "tracker-valor-ant" (Console do Firebase)
const firebaseConfig = {
  apiKey: 'AIzaSyBtvQT4Y9rzNj7ZIW5E6t3SF_b5EeD9HkY',
  authDomain: 'tracker-valor-ant.firebaseapp.com',
  projectId: 'tracker-valor-ant',
  storageBucket: 'tracker-valor-ant.firebasestorage.app',
  messagingSenderId: '678160170256',
  appId: '1:678160170256:web:c7f776dc754ec587dd7995',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app); // autenticação (login / cadastro)
export const db = getFirestore(app); // banco de dados Firestore
