// Entry file used only for bundling Firebase into a single ESM file for Chrome extensions.
// Build output: extension/vendor/firebase.js

export { initializeApp } from "firebase/app";
export { getFirestore, collection, addDoc } from "firebase/firestore";

