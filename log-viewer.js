// Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
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

// --- REFERÊNCIAS DO DOM ---
const authScreen = document.getElementById("auth-screen");
const appContent = document.getElementById("app-content");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const userEmailDisplay = document.getElementById("user-email-display");
const logoutButton = document.getElementById("logout-button");
const loginSubmitBtn = document.getElementById("login-submit-btn");

const filterForm = document.getElementById("filter-form");
const filterSubmitBtn = document.getElementById("filter-submit-btn");
const filterResetBtn = document.getElementById("filter-reset-btn");
const logsLoading = document.getElementById("logs-loading");
const listaLogs = document.getElementById("lista-logs");

// --- CONTROLE DE AUTENTICAÇÃO ---

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    toggleButtonLoading(loginSubmitBtn, true, "Entrar");

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // O onAuthStateChanged vai tratar de mostrar o app
    } catch (error) {
        console.error("Erro no login:", error.code, error.message);
        loginError.textContent = "Email ou senha inválidos.";
    } finally {
        toggleButtonLoading(loginSubmitBtn, false, "Entrar");
    }
});

logoutButton.addEventListener("click", async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuário está logado
        userEmailDisplay.textContent = user.email;
        authScreen.style.display = "none";
        appContent.style.display = "block";
        loadLogs(); // Carrega os logs iniciais
        lucide.createIcons();
    } else {
        // Usuário está deslogado
        authScreen.style.display = "flex";
        appContent.style.display = "none";
        listaLogs.innerHTML = ""; // Limpa a lista
    }
});

// --- CARREGAMENTO E FILTRO DE LOGS ---

filterForm.addEventListener("submit", (e) => {
    e.preventDefault();
    loadLogs();
});

filterResetBtn.addEventListener("click", () => {
    filterForm.reset();
    loadLogs();
});

async function loadLogs() {
    if (!auth.currentUser) return;

    logsLoading.classList.remove("hidden");
    listaLogs.innerHTML = "";
    toggleButtonLoading(filterSubmitBtn, true, "Buscar");

    try {
        const startDate = document.getElementById("filter-start-date").value;
        const endDate = document.getElementById("filter-end-date").value;
        const email = document.getElementById("filter-email").value;
        const action = document.getElementById("filter-action").value;

        // Caminho da coleção de logs
        const logsCollectionRef = collection(db, "dadosIgreja", "ADCA-CG", "logs");
        
        // Constrói a query
        let queryConstraints = [orderBy("timestamp", "desc"), limit(200)];

        if (startDate) {
            queryConstraints.push(where("timestamp", ">=", Timestamp.fromDate(new Date(`${startDate}T00:00:00`))));
        }
        if (endDate) {
            queryConstraints.push(where("timestamp", "<=", Timestamp.fromDate(new Date(`${endDate}T23:59:59`))));
        }
        if (email) {
            queryConstraints.push(where("userEmail", "==", email.trim()));
        }
        if (action) {
            // Firestore não suporta busca "LIKE" ou "contains" de forma simples e eficiente em queries
            // A melhor forma seria filtrar por "ação" exata, mas vamos filtrar no cliente
            // Por enquanto, vamos buscar por 'startsWith'.
            // Para "contains", teríamos que buscar tudo e filtrar no JS.
            queryConstraints.push(where("acao", ">=", action.trim()));
            queryConstraints.push(where("acao", "<=", action.trim() + '\uf8ff'));
        }

        const q = query(logsCollectionRef, ...queryConstraints);
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            listaLogs.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Nenhum log encontrado para os filtros aplicados.</td></tr>';
            return;
        }
        
        querySnapshot.docs.forEach(doc => {
            const log = doc.data();
            const tr = document.createElement("tr");

            // Formata a data
            const data = log.timestamp.toDate().toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'medium'
            });

            // Formata os detalhes
            const detalhes = JSON.stringify(log.detalhes, null, 2);

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${data}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${log.userEmail || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-700">${log.acao}</td>
                <td class="px-6 py-4 text-sm text-gray-900">
                    <div class="log-details">${detalhes}</div>
                </td>
            `;
            listaLogs.appendChild(tr);
        });

    } catch (error) {
        console.error("Erro ao buscar logs:", error);
        listaLogs.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-red-500">Erro ao carregar logs: ${error.message}</td></tr>`;
        
        if (error.code === 'permission-denied') {
             listaLogs.innerHTML += '<tr><td colspan="4" class="px-6 py-4 text-center text-red-700 font-bold">FALHA DE PERMISSÃO: Verifique suas Regras de Segurança do Firestore.</td></tr>';
        }
        
    } finally {
        logsLoading.classList.add("hidden");
        toggleButtonLoading(filterSubmitBtn, false, "Buscar");
        lucide.createIcons();
    }
}


// --- FUNÇÕES UTILITÁRIAS ---

function toggleButtonLoading(button, isLoading, defaultText) {
    if (!button) return;
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = `<span class="spinner"></span>Aguarde...`;
    } else {
        button.disabled = false;
        // Recria o ícone se houver
        if (defaultText === "Buscar") {
             button.innerHTML = `<i data-lucide="search" class="inline-block w-4 h-4 mr-2"></i> Buscar`;
             lucide.createIcons();
        } else {
            button.innerHTML = defaultText;
        }
    }
}

// Inicializa ícones Lucide
lucide.createIcons();