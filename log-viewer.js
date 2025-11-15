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

// [NOVO] Meses para formatação
const MESES_DO_ANO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Inicialização do Firebase
let app, auth, db;
let localLogs = []; // Array para guardar os logs carregados

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
            
            // [NOVO] Popula os filtros de data antes de carregar os logs
            const filterMes = document.getElementById("filter-mes");
            const filterAno = document.getElementById("filter-ano");
            popularFiltrosData(filterMes, filterAno, new Date());
            
            loadLogs(); // Carrega os logs iniciais
            lucide.createIcons();
        } else {
            // Usuário está deslogado
            if (authScreen) authScreen.style.display = "flex";
            if (appContent) appContent.style.display = "none";
            if (listaLogs) listaLogs.innerHTML = ""; // Limpa a lista
        }
    });


    // --- CONTROLES DO MODAL ---
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
     * Abre o modal com os detalhes do log
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
     * Gera o HTML para o conteúdo do modal (incluindo o "diff")
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
     * Gera o HTML de comparação (diff) lado a lado
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
            // [NOVO] Reseta os filtros de data para o mês/ano atual
            const filterMes = document.getElementById("filter-mes");
            const filterAno = document.getElementById("filter-ano");
            popularFiltrosData(filterMes, filterAno, new Date());
            
            // Limpa os outros filtros
            const emailInput = document.getElementById("filter-email");
            const actionInput = document.getElementById("filter-action");
            if (emailInput) emailInput.value = "";
            if (actionInput) actionInput.value = "";

            loadLogs();
        });
    }
    
    // [NOVO] Listener para o botão de Relatório
    const gerarRelatorioBtn = document.getElementById("gerar-relatorio-btn");
    if (gerarRelatorioBtn) {
        gerarRelatorioBtn.addEventListener("click", gerarRelatorioMensal);
    }

    // Inicializa ícones Lucide
    lucide.createIcons();


    // --- FUNÇÕES ---

    /**
     * [NOVO] Popula os seletores de Mês e Ano.
     */
    function popularFiltrosData(selectMes, selectAno, dataDefault) {
        if (!selectMes || !selectAno) return;

        selectMes.innerHTML = "";
        MESES_DO_ANO.forEach((mes, index) => {
            const option = document.createElement("option");
            option.value = index; // 0-11
            option.textContent = mes;
            if (index === dataDefault.getMonth()) option.selected = true;
            selectMes.appendChild(option);
        });

        selectAno.innerHTML = "";
        const anoAtual = new Date().getFullYear();
        const anoInicial = 2023; // Ano de início do seu app
        const anoFinal = anoAtual + 1; // Permite ver 1 ano no futuro
        
        for (let i = anoFinal; i >= anoInicial; i--) {
            const option = document.createElement("option");
            option.value = i;
            option.textContent = i;
            if (i === dataDefault.getFullYear()) option.selected = true;
            selectAno.appendChild(option);
        }
    }

    /**
     * Formata o objeto de detalhes do log para uma exibição amigável em HTML (na tabela principal).
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
                    // Adiciona um indicador se houver diff
                    if (detalhes.dadosAntigos || (acao === "Exclusão Membro" && detalhes.detalhesExcluidos)) {
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

    /**
     * [NOVO] Formata detalhes para o relatório (versão simples em texto).
     */
    function formatarDetalhesParaRelatorio(acao, detalhes) {
         if (!detalhes || Object.keys(detalhes).length === 0) return 'N/A';

         const formatarMoeda = (valor) => {
            if (typeof valor !== 'number') return 'R$ --,--';
            return `R$ ${Math.abs(valor).toFixed(2).replace(".", ",")}`;
        };

         try {
            switch (acao) {
                case "Membro Criado":
                case "Membro Atualizado":
                    return `Nome: ${detalhes.nome || 'N/A'}, ID: ${detalhes.membroId || 'N/A'}`;
                case "Dízimo Criado":
                    return `Membro: ${detalhes.membroNome || 'N/A'}, Valor: ${formatarMoeda(detalhes.valor)}`;
                case "Oferta/Entrada Criada":
                    return `Tipo: ${detalhes.tipo || 'N/A'}, Desc: ${detalhes.descricao || 'N/A'}, Valor: ${formatarMoeda(detalhes.valor)}`;
                case "Saída Criada":
                    return `Desc: ${detalhes.descricao || 'N/A'}, Valor: ${formatarMoeda(detalhes.valor)}`;
                case "Usuário Criado":
                     return `Nome: ${detalhes.nome || 'N/A'}, Email: ${detalhes.email || 'N/A'}`;
                case "Exclusão Membro":
                    return `ID Excluído: ${detalhes.membroId || 'N/A'}, Nome: ${detalhes.detalhesExcluidos?.nome || 'N/A'}`;
                case "Exclusão Dízimo":
                    return `ID Excluído: ${detalhes.dizimoId || 'N/A'}, Valor: ${formatarMoeda(detalhes.detalhesExcluidos?.valor)}`;
                case "Exclusão Oferta":
                    return `ID Excluído: ${detalhes.ofertaId || 'N/A'}, Valor: ${formatarMoeda(detalhes.detalhesExcluidos?.valor)}`;
                case "Exclusão Financeiro":
                    return `ID Excluído: ${detalhes.financeiroId || 'N/A'}, Valor: ${formatarMoeda(detalhes.detalhesExcluidos?.valor)}`;
                default:
                    return JSON.stringify(detalhes);
            }
        } catch (e) {
            return "Erro ao ler detalhes.";
        }
    }


    /**
     * [ALTERADO] Carrega os logs com base nos filtros de Mês/Ano.
     */
    async function loadLogs() {
        if (!auth.currentUser) return;
        
        const logsLoading = document.getElementById("logs-loading");
        const listaLogs = document.getElementById("lista-logs");
        const filterSubmitBtn = document.getElementById("filter-submit-btn");

        if (logsLoading) logsLoading.classList.remove("hidden");
        if (listaLogs) listaLogs.innerHTML = "";
        localLogs = []; // Limpa os logs locais
        toggleButtonLoading(filterSubmitBtn, true, "Buscar");

        try {
            // [NOVOS FILTROS]
            const filterMes = document.getElementById("filter-mes");
            const filterAno = document.getElementById("filter-ano");
            const emailInput = document.getElementById("filter-email");
            const actionInput = document.getElementById("filter-action");
            
            const mesNum = parseInt(filterMes.value);
            const anoNum = parseInt(filterAno.value);
            const email = emailInput ? emailInput.value : null;
            const action = actionInput ? actionInput.value : null;

            // Calcula o primeiro e o último dia do mês
            const startDate = new Date(anoNum, mesNum, 1);
            const endDate = new Date(anoNum, mesNum + 1, 0, 23, 59, 59); // 23:59:59 do último dia

            // Caminho da coleção de logs
            const logsCollectionRef = collection(db, "dadosIgreja", "ADCA-CG", "logs");
            
            // Constrói a query
            let queryConstraints = [
                orderBy("timestamp", "desc"),
                where("timestamp", ">=", Timestamp.fromDate(startDate)),
                where("timestamp", "<=", Timestamp.fromDate(endDate))
            ];

            if (email) {
                queryConstraints.push(where("userEmail", "==", email.trim()));
            }
            if (action) {
                queryConstraints.push(where("acao", ">=", action.trim()));
                queryConstraints.push(where("acao", "<=", action.trim() + '\uf8ff'));
            }
            
            // Limita a exibição na tela
            queryConstraints.push(limit(200));

            const q = query(logsCollectionRef, ...queryConstraints);
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                if(listaLogs) listaLogs.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Nenhum log encontrado para os filtros aplicados.</td></tr>';
                return;
            }
            
            querySnapshot.docs.forEach(doc => {
                const log = { id: doc.id, ...doc.data() }; // Salva o log com ID
                localLogs.push(log); // Adiciona ao array local
                
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
            addLogClickListeners(); // Adiciona os listeners de clique
            lucide.createIcons();
        }
    }

    /**
     * [NOVO] Gera o relatório mensal de logs.
     */
    async function gerarRelatorioMensal() {
        if (!auth.currentUser) return;
        
        const filterSubmitBtn = document.getElementById("gerar-relatorio-btn");
        toggleButtonLoading(filterSubmitBtn, true, "Gerando...");

        try {
            const filterMes = document.getElementById("filter-mes");
            const filterAno = document.getElementById("filter-ano");
            const emailInput = document.getElementById("filter-email");
            const actionInput = document.getElementById("filter-action");
            
            const mesNum = parseInt(filterMes.value);
            const anoNum = parseInt(filterAno.value);
            const nomeMes = MESES_DO_ANO[mesNum];
            
            const email = emailInput ? emailInput.value : null;
            const action = actionInput ? actionInput.value : null;

            const startDate = new Date(anoNum, mesNum, 1);
            const endDate = new Date(anoNum, mesNum + 1, 0, 23, 59, 59);

            const logsCollectionRef = collection(db, "dadosIgreja", "ADCA-CG", "logs");
            
            // Query para o relatório: SEM LIMITE, ordem ASCENDENTE
            let queryConstraints = [
                orderBy("timestamp", "asc"), // Relatório em ordem cronológica
                where("timestamp", ">=", Timestamp.fromDate(startDate)),
                where("timestamp", "<=", Timestamp.fromDate(endDate))
            ];

            if (email) {
                queryConstraints.push(where("userEmail", "==", email.trim()));
            }
            if (action) {
                queryConstraints.push(where("acao", ">=", action.trim()));
                queryConstraints.push(where("acao", "<=", action.trim() + '\uf8ff'));
            }

            const q = query(logsCollectionRef, ...queryConstraints);
            const querySnapshot = await getDocs(q);
            
            let logsHtml = "";
            if (querySnapshot.empty) {
                logsHtml = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Nenhum log encontrado para este período.</td></tr>';
            } else {
                 logsHtml = querySnapshot.docs.map(doc => {
                    const log = doc.data();
                    const data = log.timestamp.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
                    const detalhes = formatarDetalhesParaRelatorio(log.acao, log.detalhes);
                    return `
                        <tr>
                            <td>${data}</td>
                            <td>${log.userEmail || 'N/A'}</td>
                            <td>${log.acao}</td>
                            <td>${detalhes}</td>
                        </tr>
                    `;
                }).join('');
            }
           
            // Construir o HTML do Relatório
            let relatorioHTML = `
                <html>
                <head>
                    <title>Relatório de Logs - ${nomeMes}/${anoNum}</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @media print {
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            .no-print { display: none; }
                        }
                        body { font-family: sans-serif; }
                        h1 { font-size: 24px; font-weight: bold; color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 10px; }
                        th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; word-break: break-all; }
                        th { background-color: #f3f4f6; font-weight: 600; }
                    </style>
                </head>
                <body class="bg-gray-100 p-8">
                    <div class="container mx-auto bg-white p-10 rounded shadow-lg">
                        <div class="flex justify-between items-center mb-6">
                            <h1>Relatório de Auditoria</h1>
                            <button onclick="window.print()" class="no-print bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700">Imprimir</button>
                        </div>
                        <p class="text-sm text-gray-600 mb-2">Período: <span class="font-medium">${nomeMes} de ${anoNum}</span></p>
                        <p class="text-sm text-gray-600 mb-6">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
                        <table>
                            <thead>
                                <tr>
                                    <th>Data/Hora</th>
                                    <th>Usuário</th>
                                    <th>Ação</th>
                                    <th>Detalhes</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${logsHtml}
                            </tbody>
                        </table>
                    </div>
                </body>
                </html>
            `;

            const relatorioJanela = window.open("", "_blank");
            if (!relatorioJanela) {
                alert("Não foi possível abrir a janela do relatório. Verifique se o seu navegador está bloqueando pop-ups.");
                return;
            }
            relatorioJanela.document.write(relatorioHTML);
            relatorioJanela.document.close();

        } catch (error) {
            console.error("Erro ao gerar relatório:", error);
            alert("Erro ao gerar relatório: " + error.message);
        } finally {
            toggleButtonLoading(filterSubmitBtn, false, "Gerar Relatório Mensal");
            lucide.createIcons();
        }
    }


    /**
     * Adiciona listeners de clique aos detalhes do log
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
            } else if (defaultText === "Gerar Relatório Mensal") {
                 button.innerHTML = `<i data-lucide="printer" class="inline-block w-4 h-4 mr-2"></i> Gerar Relatório Mensal`;
            }
             else {
                button.innerHTML = defaultText;
            }
            lucide.createIcons(); // Recria todos os ícones (simples e seguro)
        }
    }

} // --- Fim do initializeAppUI ---


// Lógica para iniciar a UI
// Como o script é "type=module" e está no fim do <body>,
// o DOM já está pronto. Apenas chamamos a função diretamente.
initializeAppUI();
