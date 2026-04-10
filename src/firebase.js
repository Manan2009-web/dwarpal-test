// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAjF_7ttuUMkzDU8_TgUgU3jZU4OLqJQf0",
  authDomain: "dwarpal-c4843.firebaseapp.com",
  projectId: "dwarpal-c4843",
  storageBucket: "dwarpal-c4843.firebasestorage.app",
  messagingSenderId: "492616305801",
  appId: "1:492616305801:web:5736516f275b80d9bcca58",
  measurementId: "G-6L3SMHMLSQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);