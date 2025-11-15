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
let localLogs = []; // [NOVO] Array para guardar os logs carregados

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase (Log Viewer) inicializado.");
} catch (error) {
    console.error("Erro ao inicializar o Firebase:", error);
    document.body.innerHTML = "<p>Erro crítico ao conectar ao banco de dados.</p>";
}

// --- Função principal da UI ---
function initializeAppUI() {

    // --- CONTROLE DE AUTENTICAÇÃO ---

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const loginError = document.getElementById("login-error");
            const loginSubmitBtn = document.getElementById("login-submit-btn");
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
    }

    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            try {
                await signOut(auth);
            } catch (error) {
                console.error("Erro ao sair:", error);
            }
        });
    }

    onAuthStateChanged(auth, (user) => {
        const authScreen = document.getElementById("auth-screen");
        const appContent = document.getElementById("app-content");
        const userEmailDisplay = document.getElementById("user-email-display");
        const listaLogs = document.getElementById("lista-logs");

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


    // --- [NOVO] CONTROLES DO MODAL ---
    const logDetalhesModal = document.getElementById("log-detalhes-modal");
    const closeLogModal = document.getElementById("close-log-modal");
    const logModalTitle = document.getElementById("log-modal-title");
    const logModalContent = document.getElementById("log-modal-content");

    if (closeLogModal) {
        closeLogModal.onclick = () => {
            if (logDetalhesModal) logDetalhesModal.style.display = "none";
        };
    }
    
    // Clica fora para fechar
    window.onclick = function (event) {
        if (event.target == logDetalhesModal) {
            logDetalhesModal.style.display = "none";
        }
    }

    /**
     * [NOVO] Abre o modal com os detalhes do log
     */
    function showLogDetalhesModal(logId) {
        const log = localLogs.find(l => l.id === logId);
        if (!log) {
            console.error("Log não encontrado:", logId);
            return;
        }

        if (logModalTitle) logModalTitle.textContent = `Detalhes: ${log.acao}`;
        if (logModalContent) {
            logModalContent.innerHTML = generateModalContent(log);
        }
        if (logDetalhesModal) logDetalhesModal.style.display = "block";
    }

    /**
     * [NOVO] Gera o HTML para o conteúdo do modal (incluindo o "diff")
     */
    function generateModalContent(log) {
        const { acao, detalhes } = log;

        // 1. Caso: "Membro Atualizado" (com dados antigos e novos)
        if (acao === "Membro Atualizado" && detalhes.dadosAntigos && detalhes.dadosNovos) {
            return generateDiffHtml(detalhes.dadosAntigos, detalhes.dadosNovos);
        }

        // 2. Caso: Exclusões (mostra o que foi excluído)
        if (acao.startsWith("Exclusão") && detalhes.detalhesExcluidos) {
            let html = '<h3 class="text-lg font-semibold text-red-700">Dados que foram excluídos:</h3>';
            html += '<div class="log-details-fallback">'; // Reusa o estilo de "fallback"
            html += JSON.stringify(detalhes.detalhesExcluidos, null, 2)
                .replace(/\\n/g, '<br>')
                .replace(/"([^"]+)":/g, '<span class="text-blue-600 font-medium">"$1"</span>:');
            html += '</div>';
            return html;
        }

        // 3. Caso: Criações (mostra o que foi criado)
        if (acao.endsWith("Criado")) {
            let html = '<h3 class="text-lg font-semibold text-green-700">Dados do novo item criado:</h3>';
            html += '<div class="log-details-fallback">';
            const simpleDetalhes = { ...detalhes };
            delete simpleDetalhes.dadosAntigos; // Limpa (caso exista em logs antigos)
            delete simpleDetalhes.dadosNovos;   // Limpa
            html += JSON.stringify(simpleDetalhes, null, 2)
                 .replace(/\\n/g, '<br>')
                 .replace(/"([^"]+)":/g, '<span class="text-blue-600 font-medium">"$1"</span>:');
            html += '</div>';
            return html;
        }

        // 4. Fallback: Se for um formato antigo ou não reconhecido
        return `<p>Não há detalhes de comparação para esta ação.</p><div class="log-details-fallback">${JSON.stringify(detalhes, null, 2)}</div>`;
    }

    /**
     * [NOVO] Gera o HTML de comparação (diff) lado a lado
     */
    function generateDiffHtml(antigo, novo) {
        let html = '<div class="diff-grid">';
        
        // Formata as chaves para serem mais legíveis
        const labels = {
            nome: 'Nome', dataNascimento: 'Data Nasc.', telefone: 'Telefone', email: 'Email',
            cpf: 'CPF', rg: 'RG', naturalidade: 'Naturalidade', endereco: 'Endereço',
            nomePai: 'Pai', nomeMae: 'Mãe', estadoCivil: 'Estado Civil', conjuge: 'Cônjuge',
            profissao: 'Profissão', escolaridade: 'Escolaridade', funcao: 'Função',
            dataBatismo: 'Data Batismo', dataChegada: 'Data Chegada',
            igrejaAnterior: 'Igreja Anterior', cargoAnterior: 'Cargo Anterior'
        };

        const chaves = new Set([...Object.keys(antigo), ...Object.keys(novo)]);
        
        // Coluna "Antes"
        let colAntes = '<div class="diff-col diff-col-antes"><h3>DE (Antigo)</h3>';
        for (const key of chaves) {
            // Pula chaves que não são dados do membro
            if (!labels[key]) continue; 
            
            const valAntigo = antigo[key] || '---';
            const valNovo = novo[key] || '---';
            const mudou = String(valAntigo) !== String(valNovo);
            
            colAntes += `<div class="diff-item">
                        <span class="diff-label">${labels[key]}</span>
                        <span class="diff-value ${mudou ? 'diff-highlight' : ''}">${valAntigo}</span>
                       </div>`;
        }
        colAntes += '</div>'; // Fim da coluna "Antes"
        
        // Coluna "Depois"
        let colDepois = '<div class="diff-col diff-col-depois"><h3>PARA (Novo)</h3>';
        for (const key of chaves) {
             // Pula chaves que não são dados do membro
            if (!labels[key]) continue;
            
            const valAntigo = antigo[key] || '---';
            const valNovo = novo[key] || '---';
            const mudou = String(valAntigo) !== String(valNovo);

            colDepois += `<div class="diff-item">
                        <span class="diff-label">${labels[key]}</span>
                        <span class="diff-value ${mudou ? 'diff-highlight' : ''}">${valNovo}</span>
                       </div>`;
        }
        colDepois += '</div>'; // Fim da coluna "Depois"

        html += colAntes + colDepois; // Junta as colunas
        html += '</div>'; // Fim do grid
        return html;
    }


    // --- CARREGAMENTO E FILTRO DE LOGS ---

    const filterForm = document.getElementById("filter-form");
    if (filterForm) {
        filterForm.addEventListener("submit", (e) => {
            e.preventDefault();
            loadLogs();
        });
    }

    const filterResetBtn = document.getElementById("filter-reset-btn");
    if (filterResetBtn) {
        filterResetBtn.addEventListener("click", () => {
            if (filterForm) filterForm.reset();
            loadLogs();
        });
    }

    // Inicializa ícones Lucide
    lucide.createIcons();


    // --- FUNÇÕES ---

    /**
     * Formata o objeto de detalhes do log para uma exibição amigável em HTML (na tabela principal).
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
                    // [NOVO] Adiciona um indicador se houver diff
                    if (detalhes.dadosAntigos) {
                        html += `<span class="text-xs text-blue-500 font-medium">(Clique para ver ${acao === 'Membro Atualizado' ? 'mudanças' : 'detalhes'})</span>`;
                    }
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
                           item("Nome Excluído", detalhes.detalhesExcluidos?.nome || 'N/A') +
                           `<span class="text-xs text-red-500 font-medium">(Clique para ver dados excluídos)</span>`;
                    break;

                case "Exclusão Dízimo":
                    html = item("ID Excluído", detalhes.dizimoId) +
                           item("Membro (na época)", detalhes.detalhesExcluidos?.membroNome || 'N/A') +
                           `<span class="text-xs text-red-500 font-medium">(Clique para ver dados excluídos)</span>`;
                    break;
                
                case "Exclusão Oferta":
                     html = item("ID Excluído", detalhes.ofertaId) +
                           item("Descrição (na época)", detalhes.detalhesExcluidos?.descricao || 'N/A') +
                           `<span class="text-xs text-red-500 font-medium">(Clique para ver dados excluídos)</span>`;
                    break;

                case "Exclusão Financeiro":
                     html = item("ID Excluído", detalhes.financeiroId) +
                           item("Descrição (na época)", detalhes.detalhesExcluidos?.descricao || 'N/A') +
                           `<span class="text-xs text-red-500 font-medium">(Clique para ver dados excluídos)</span>`;
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
        
        const logsLoading = document.getElementById("logs-loading");
        const listaLogs = document.getElementById("lista-logs");
        const filterSubmitBtn = document.getElementById("filter-submit-btn");

        if (logsLoading) logsLoading.classList.remove("hidden");
        if (listaLogs) listaLogs.innerHTML = "";
        localLogs = []; // [NOVO] Limpa os logs locais
        toggleButtonLoading(filterSubmitBtn, true, "Buscar");

        try {
            const startDateInput = document.getElementById("filter-start-date");
            const endDateInput = document.getElementById("filter-end-date");
            const emailInput = document.getElementById("filter-email");
            const actionInput = document.getElementById("filter-action");

            const startDate = startDateInput ? startDateInput.value : null;
            const endDate = endDateInput ? endDateInput.value : null;
            const email = emailInput ? emailInput.value : null;
            const action = actionInput ? actionInput.value : null;

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
                // Esta é uma consulta 'começa com' (prefix)
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
                const log = { id: doc.id, ...doc.data() }; // [ALTERAÇÃO] Salva o log com ID
                localLogs.push(log); // [NOVO] Adiciona ao array local
                
                const tr = document.createElement("tr");

                // Formata a data
                const data = log.timestamp.toDate().toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'medium'
                });

                const detalhesHtml = formatarDetalhes(log.acao, log.detalhes);

                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 align-top">${data}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 align-top">${log.userEmail || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-700 align-top">${log.acao}</td>
                    <td class="px-6 py-4 text-sm text-gray-900 align-top">
                        <div class="log-details-container log-details-clickable" data-log-id="${log.id}">
                            ${detalhesHtml}
                        </div>
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
            addLogClickListeners(); // [NOVO] Adiciona os listeners de clique
            lucide.createIcons();
        }
    }

    /**
     * [NOVO] Adiciona listeners de clique aos detalhes do log
     */
    function addLogClickListeners() {
        document.querySelectorAll('.log-details-clickable').forEach(el => {
            // Remove listener antigo para evitar duplicatas ao recarregar
            el.replaceWith(el.cloneNode(true));
        });

        // Adiciona novos listeners
        document.querySelectorAll('.log-details-clickable').forEach(el => {
            el.addEventListener('click', (e) => {
                const logId = e.currentTarget.dataset.logId;
                showLogDetalhesModal(logId);
            });
        });
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

} // --- Fim do initializeAppUI ---


// Lógica para iniciar a UI
// Como o script é "type=module" e está no fim do <body>,
// o DOM já está pronto. Apenas chamamos a função diretamente.
initializeAppUI();
