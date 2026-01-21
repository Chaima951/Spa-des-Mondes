/* =========================================================
   1. CONFIGURATION ET IMPORTATIONS
   ========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ⚠️ COLLE TES CLÉS FIREBASE ICI (Attention aux accolades) ---
const firebaseConfig = {
  apiKey: "AIzaSyC-4VoHlyQyOq61h0JdHfbh-WI3G8gMjKo",
  authDomain: "rituels-du-monde-46b3d.firebaseapp.com",
  projectId: "rituels-du-monde-46b3d",
  storageBucket: "rituels-du-monde-46b3d.firebasestorage.app",
  messagingSenderId: "707924426339",
  appId: "1:707924426339:web:f6c69cbc867cf86cee4256",
  measurementId: "G-6ZPD1B9VXN"
};

// Initialisation Sécurisée de la Base de Données
let db;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase connecté avec succès !");
} catch (error) {
    console.error("Erreur Firebase :", error);
    alert("Erreur de connexion à la base de données. Vérifiez la console (F12) et votre clé API dans script.js");
}

/* =========================================================
   2. LOGIQUE GLOBALE (S'exécute au chargement)
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
    initChatbot(); 
    
    // Configuration date minimum (Pas de passé)
    const inputDate = document.getElementById('input-date');
    if(inputDate) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        inputDate.min = now.toISOString().slice(0,16);
    }
});

// Variables
let selectedService = { id: null, name: null, price: 0, desc: "" };
const OPENING_HOUR = 10; 
const CLOSING_HOUR = 20; 
const CLOSED_DAYS = [0]; // Dimanche

/* =========================================================
   3. FONCTIONS DE RÉSERVATION (UI)
   ========================================================= */
// On attache tout à "window" pour que les boutons HTML puissent les voir

window.selectService = function(name, price, id, desc) {
    console.log("Service sélectionné :", name); // Debug

    selectedService = { id: id, name: name, price: price, desc: desc };

    // Visuel
    document.querySelectorAll('.service-card').forEach(el => el.classList.remove('selected'));
    const element = document.getElementById(id);
    if(element) element.classList.add('selected');
    
    // Résumé
    const sumSoin = document.getElementById('sum-soin');
    const sumPrice = document.getElementById('sum-price');
    if(sumSoin) sumSoin.innerText = name;
    if(sumPrice) sumPrice.innerText = price.toFixed(2) + " €";
    
    // Suite
    setTimeout(() => window.goToStep(2), 400);
};

window.goToStep = function(n) {
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.step-bar').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById('step-'+n);
    if(target) target.classList.add('active');
    
    for(let i=1; i<=n; i++) {
        const bar = document.getElementById('bar-'+i);
        if(bar) bar.classList.add('active');
    }
};

window.updateDateDisplay = function(val) {
    const sumDate = document.getElementById('sum-date');
    if(!val) return;

    const d = new Date(val);
    const day = d.getDay();
    const hour = d.getHours();

    // Vérif Horaires
    if (CLOSED_DAYS.includes(day)) {
        alert("Le spa est fermé le Dimanche.");
        document.getElementById('input-date').value = "";
        sumDate.innerText = "--/--";
        return;
    }
    if (hour < OPENING_HOUR || hour >= CLOSING_HOUR) {
        alert(`Le spa est ouvert de ${OPENING_HOUR}h à ${CLOSING_HOUR}h.`);
        document.getElementById('input-date').value = "";
        sumDate.innerText = "--/--";
        return;
    }

    const dayStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const hourStr = String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
    sumDate.innerText = `${dayStr} à ${hourStr}`;
};

/* =========================================================
   4. VALIDATION ET PAIEMENT (LE CERVEAU)
   ========================================================= */
window.finalizeBooking = async function() {
    console.log("Tentative de finalisation..."); // Debug
    const btn = document.querySelector('#step-3 .btn');
    
    // 1. Vérifs
    const dateVal = document.getElementById('input-date').value;
    if (!selectedService.name) { alert("Sélectionnez un soin."); window.goToStep(1); return; }
    if (!dateVal) { alert("Choisissez une date."); window.goToStep(2); return; }

    const staff = document.getElementById('input-staff').value;
    const pression = document.getElementById('input-pression').value;
    const music = document.getElementById('input-music').value;
    const drink = document.getElementById('input-drink').value;
    const notes = document.getElementById('input-notes').value;

    const dateObj = new Date(dateVal);
    const datePart = dateObj.toISOString().split('T')[0]; 
    const timePart = dateObj.getHours();

    btn.innerText = "Vérification...";
    btn.disabled = true;

    try {
        // 2. Question à Firebase
        const q = query(collection(db, "reservations"), 
            where("date", "==", datePart),
            where("heure", "==", timePart),
            where("praticienne", "==", staff)
        );
        
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            alert(`Créneau indisponible ! ${staff} est déjà prise à ${timePart}h.`);
            btn.innerText = "Valider et Payer";
            btn.disabled = false;
            return;
        }

        // 3. Réservation (Si libre)
        await addDoc(collection(db, "reservations"), {
            soin: selectedService.name,
            prix: selectedService.price,
            date: datePart,
            heure: timePart,
            praticienne: staff,
            status: "En cours de paiement",
            created_at: new Date()
        });

        // 4. Snipcart
        const dateFormatted = dateObj.toLocaleDateString('fr-FR') + ' à ' + timePart + 'h00';
        
        Snipcart.api.cart.items.add({
            id: selectedService.id,
            name: selectedService.name,
            price: selectedService.price,
            url: '/reservation.html',
            description: selectedService.desc,
            image: "https://via.placeholder.com/150", 
            customFields: [
                { name: "Date", value: dateFormatted, type: "readonly" },
                { name: "Praticienne", value: staff, type: "readonly" },
                { name: "Options", value: `${pression} / ${music}`, type: "hidden" }
            ]
        }).then(() => {
            Snipcart.api.theme.cart.open();
            btn.innerText = "Valider et Payer";
            btn.disabled = false;
        });

    } catch (e) {
        console.error("Erreur Technique : ", e);
        alert("Erreur de connexion. Avez-vous bien mis vos clés API ? Regardez la console (F12).");
        btn.innerText = "Valider et Payer";
        btn.disabled = false;
    }
};

/* =========================================================
   5. CHATBOT
   ========================================================= */
function initChatbot() {
    const html = `
    <div id="chatbot-widget">
        <div class="chat-window" id="cWindow">
            <div class="chat-header"><span>✦ Guide</span><span style="cursor:pointer" onclick="window.toggleChat()">×</span></div>
            <div class="chat-body" id="cBody"><div class="msg bot">Bonjour. Besoin d'aide ?</div></div>
            <div class="chat-input"><input type="text" id="cInput" placeholder="..." onkeypress="window.handleKey(event)"><button onclick="window.sendMsg()" class="btn">→</button></div>
        </div>
        <div class="chat-btn" onclick="window.toggleChat()">💬</div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

window.toggleChat = function() { document.getElementById('cWindow').classList.toggle('open'); };
window.handleKey = function(e) { if(e.key === 'Enter') window.sendMsg(); };

window.sendMsg = function() {
    const input = document.getElementById('cInput');
    const body = document.getElementById('cBody');
    const txt = input.value.trim();
    if(!txt) return;
    body.innerHTML += `<div class="msg user">${txt}</div>`;
    input.value = '';
    setTimeout(() => body.innerHTML += `<div class="msg bot">Je suis là pour vous aider.</div>`, 800);
};