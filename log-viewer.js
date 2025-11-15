// Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
// ... (o restante das importações não foi alterado) ...
    limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ATENÇÃO: Use a MESMA configuração do seu app principal
const firebaseConfig = {
// ... (o restante da configuração não foi alterado) ...
};

// Inicialização do Firebase
let app, auth, db;
try {
// ... (o restante da inicialização não foi alterado) ...
}

// --- REFERÊNCIAS DO DOM ---
const authScreen = document.getElementById("auth-screen");
// ... (o restante das referências não foi alterado) ...
const listaLogs = document.getElementById("lista-logs");

// --- CONTROLE DE AUTENTICAÇÃO ---

loginForm.addEventListener("submit", async (e) => {
// ... (o restante da função não foi alterado) ...
});

logoutButton.addEventListener("click", async () => {
// ... (o restante da função não foi alterado) ...
});

onAuthStateChanged(auth, (user) => {
// ... (o restante da função não foi alterado) ...
});

// --- [NOVO] FUNÇÃO PARA FORMATAR DETALHES DO LOG ---

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


// --- CARREGAMENTO E FILTRO DE LOGS ---

filterForm.addEventListener("submit", (e) => {
// ... (o restante da função não foi alterado) ...
});

filterResetBtn.addEventListener("click", () => {
// ... (o restante da função não foi alterado) ...
});

async function loadLogs() {
    if (!auth.currentUser) return;

// ... (o restante da função não foi alterado) ...
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
            listaLogs.appendChild(tr);
        });

    } catch (error) {
// ... (o restante da função não foi alterado) ...
        
    } finally {
// ... (o restante da função não foi alterado) ...
    }
}


// --- FUNÇÕES UTILITÁRIAS ---

function toggleButtonLoading(button, isLoading, defaultText) {
// ... (o restante da função não foi alterado) ...
}

// Inicializa ícones Lucide
lucide.createIcons();
