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

// --- [NOVO] Executar apenas após o DOM estar pronto ---
window.addEventListener('DOMContentLoaded', () => {

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

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (loginError) loginError.textContent = "";
            toggleButtonLoading(loginSubmitBtn, true, "Entrar");

            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-password").value;

            try {
                await signInWithEmailAndPassword(auth, email, password);
                // O onAuthStateChanged vai tratar de mostrar o app
            } catch (error) {
                console.error("Erro no login:", error.code, error.message);
                if (loginError) loginError.textContent = "Email ou senha inválidos.";
            } finally {
                toggleButtonLoading(loginSubmitBtn, false, "Entrar");
            }
        });
    } else {
        console.error("Elemento 'login-form' não encontrado.");
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            try {
                await signOut(auth);
            } catch (error) {
                console.error("Erro ao sair:", error);
            }
        });
    } else {
        console.error("Elemento 'logout-button' não encontrado.");
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuário está logado
            if (userEmailDisplay) userEmailDisplay.textContent = user.email;
            if (authScreen) authScreen.style.display = "none";
            if (appContent) appContent.style.display = "block";
            loadLogs(); // Carrega os logs iniciais
            lucide.createIcons();
        } else {
            // Usuário está deslogado
            if (authScreen) authScreen.style.display = "flex";
            if (appContent) appContent.style.display = "none";
            if (listaLogs) listaLogs.innerHTML = ""; // Limpa a lista
        }
    });


    // --- CARREGAMENTO E FILTRO DE LOGS ---

    if (filterForm) {
        filterForm.addEventListener("submit", (e) => {
            e.preventDefault();
            loadLogs();
        });
    } else {
        console.error("Elemento 'filter-form' não encontrado.");
    }

    if (filterResetBtn) {
        filterResetBtn.addEventListener("click", () => {
            if (filterForm) filterForm.reset();
            loadLogs();
        });
    } else {
         console.error("Elemento 'filter-reset-btn' não encontrado.");
    }

    // Inicializa ícones Lucide
    lucide.createIcons();


    // --- FUNÇÕES ---

    /**
     * Formata o objeto de detalhes do log para uma exibição amigável em HTML.
     * @param {string} acao - A ação registrada.
     * @param {object} detalhes - O objeto de detalhes do log.
     * @returns {string} - Uma string HTML formatada.
     */
    function formatarDetalhes(acao, detalhes) {
        if (!detalhes || Object.keys(detalhes).length === 0) {
            return '<span class="text-gray-400">N/A</span>';
        }

        // Função auxiliar para formatar valor monetário
        const formatarMoeda = (valor) => {
            if (typeof valor !== 'number') return 'R$ --,--';
            // Math.abs para lidar com saídas (valores negativos)
            return `R$ ${Math.abs(valor).toFixed(2).replace(".", ",")}`;
        };

        // Função auxiliar para criar um item de detalhe
        const item = (label, value) => {
            if (!value) return ''; // Não mostra o item se o valor for nulo/vazio
            return `<div class="log-detail-item">
                        <span class="log-detail-label">${label}:</span>
                        <span class="log-detail-value">${value}</span>
                    </div>`;
        };

        let html = '';

        try {
            switch (acao) {
                case "Membro Criado":
                case "Membro Atualizado":
                    html = item("Nome", detalhes.nome) + item("ID Membro", detalhes.membroId);
                    break;
                
                case "Dízimo Criado":
                    html = item("Membro", detalhes.membroNome) +
                           item("Valor", formatarMoeda(detalhes.valor)) +
                           item("ID Dízimo", detalhes.dizimoId);
                    break;

                case "Oferta/Entrada Criada":
                    html = item("Tipo", detalhes.tipo) +
                           item("Descrição", detalhes.descricao) +
                           item("Valor", formatarMoeda(detalhes.valor)) +
                           item("ID Oferta", detalhes.ofertaId);
                    break;

                case "Saída Criada":
                    html = item("Descrição", detalhes.descricao) +
                           item("Valor", formatarMoeda(detalhes.valor)) +
                           item("ID Lançamento", detalhes.financeiroId);
                    break;

                case "Usuário Criado":
                    html = item("Nome", detalhes.nome) + item("Email", detalhes.email);
                    break;
                
                case "Exclusão Membro":
                    html = item("ID Excluído", detalhes.membroId) +
                           item("Nome Excluído", detalhes.detalhesExcluidos?.nome || 'N/A');
                    break;

                case "Exclusão Dízimo":
                    html = item("ID Excluído", detalhes.dizimoId) +
                           item("Membro (na época)", detalhes.detalhesExcluidos?.membroNome || 'N/A') +
                           item("Valor Excluído", formatarMoeda(detalhes.detalhesExcluidos?.valor));
                    break;
                
                case "Exclusão Oferta":
                     html = item("ID Excluído", detalhes.ofertaId) +
                           item("Descrição (na época)", detalhes.detalhesExcluidos?.descricao || 'N/A') +
                           item("Valor Excluído", formatarMoeda(detalhes.detalhesExcluidos?.valor));
                    break;

                case "Exclusão Financeiro":
                     html = item("ID Excluído", detalhes.financeiroId) +
                           item("Descrição (na época)", detalhes.detalhesExcluidos?.descricao || 'N/A') +
                           item("Valor Excluído", formatarMoeda(detalhes.detalhesExcluidos?.valor));
                    break;

                default:
                    // Fallback para JSON formatado se a ação não for reconhecida
                    html = `<div class="log-details-fallback">${JSON.stringify(detalhes, null, 2)}</div>`;
            }
        } catch (e) {
            console.error("Erro ao formatar detalhes do log:", e, detalhes);
            html = '<span class="text-red-500">Erro ao ler detalhes.</span>';
        }

        return html || '<span class="text-gray-400">N/A</span>';
    }


    async function loadLogs() {
        if (!auth.currentUser) return;

        if (logsLoading) logsLoading.classList.remove("hidden");
        if (listaLogs) listaLogs.innerHTML = "";
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
                if(listaLogs) listaLogs.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Nenhum log encontrado para os filtros aplicados.</td></tr>';
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

                // [ALTERAÇÃO] Formata os detalhes usando a nova função
                const detalhesHtml = formatarDetalhes(log.acao, log.detalhes);

                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 align-top">${data}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 align-top">${log.userEmail || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-700 align-top">${log.acao}</td>
                    <td class="px-6 py-4 text-sm text-gray-900 align-top">
                        <div class="log-details-container">${detalhesHtml}</div>
                    </td>
                `;
                if(listaLogs) listaLogs.appendChild(tr);
            });

        } catch (error) {
            console.error("Erro ao buscar logs:", error);
            if(listaLogs) listaLogs.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-red-500">Erro ao carregar logs: ${error.message}</td></tr>`;
            
            if (error.code === 'permission-denied') {
                 if(listaLogs) listaLogs.innerHTML += '<tr><td colspan="4" class="px-6 py-4 text-center text-red-700 font-bold">FALHA DE PERMISSÃO: Verifique suas Regras de Segurança do Firestore.</td></tr>';
            }
            
        } finally {
            if (logsLoading) logsLoading.classList.add("hidden");
            toggleButtonLoading(filterSubmitBtn, false, "Buscar");
            lucide.createIcons();
        }
    }


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

}); // Fim do 'DOMContentLoaded'
