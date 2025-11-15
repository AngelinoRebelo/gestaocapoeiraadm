// Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
// ... (todo o código de importação e configuração do firebase igual) ...
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    Timestamp,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ATENÇÃO: Use a MESMA configuração do seu app principal
const firebaseConfig = {
    apiKey: "AIzaSyA59Apn8I_8uT7XBrMIS_zD1RdtHgJCzOA",
    authDomain: "gestao-capoeira.firebaseapp.com",
    projectId: "gestao-capoeira",
    storageBucket: "gestao-capoeira.firebasestorage.app",
    messagingSenderId: "907559288919",
    appId: "1:907559288919:web:a4afdb4ed23e9d11196312"
};

// Inicialização do Firebase
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase (Log Viewer) inicializado.");
} catch (error) {
    console.error("Erro ao inicializar o Firebase:", error);
    document.body.innerHTML = "<p>Erro crítico ao conectar ao banco de dados.</p>";
}

// --- [CORREÇÃO] Função principal da UI ---
// Esta função contém todo o código que interage com o HTML
function initializeAppUI() {

    // --- CONTROLE DE AUTENTICAÇÃO ---

    const loginForm = document.getElementById("login-form");
// ... (todo o restante do código da função initializeAppUI permanece exatamente o mesmo) ...
    function toggleButtonLoading(button, isLoading, defaultText) {
// ... (código da função toggleButtonLoading) ...
                 lucide.createIcons();
            } else {
                button.innerHTML = defaultText;
            }
        }
    }

} // --- Fim do initializeAppUI ---


// --- [ALTERAÇÃO] Lógica para iniciar a UI ---
// Como o script é "type=module" e está no fim do <body>,
// o DOM já está pronto. Apenas chamamos a função diretamente.
initializeAppUI();
