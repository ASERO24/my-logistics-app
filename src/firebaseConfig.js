// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC8iG48uHW0g6p5R8QuFvBcO2FZH83AEfc",
  authDomain: "logisticsapp-e29ec.firebaseapp.com",
  projectId: "logisticsapp-e29ec",
  storageBucket: "logisticsapp-e29ec.firebasestorage.app",
  messagingSenderId: "434929366811",
  appId: "1:434929366811:web:7caab7c1e9c94c0c6b85be",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
