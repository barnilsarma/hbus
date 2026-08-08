// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB8uXcroVnNUgwENMHEEDKSYSt5p_G2RpY",
  authDomain: "hbus-63296.firebaseapp.com",
  projectId: "hbus-63296",
  storageBucket: "hbus-63296.firebasestorage.app",
  messagingSenderId: "561280744732",
  appId: "1:561280744732:web:3c8434addd6b241c2dced9",
  measurementId: "G-CEHJBQ8SM8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleAuthProvider = new GoogleAuthProvider();

const signInWithGoogle = () => signInWithPopup(auth, googleAuthProvider);

export { auth, googleAuthProvider, signInWithGoogle };
