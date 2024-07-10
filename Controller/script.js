const CLIENT_ID = '180232621156-t6romfde6nvdtuab3k8mlc35t2u045tf.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDLjC4QyhtwwxcpNxLnglpcGpVKNPzS9yE';

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events';

let tokenClient;
let gapiInited = false;
let gisInited = false;


/**
 * Carrega o cliente da API do Google quando o gapi é carregado.
 */
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

/**
 * Inicializa o cliente da API do Google com a chave de API e documento de descoberta.
 */
async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
}

/**
 * Carrega o cliente de token quando o gis é carregado.
 */
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // definido posteriormente
    });
    gisInited = true;
    maybeEnableButtons();
}

/**
 * Habilita botões se tanto gapi quanto gis estiverem inicializados.
 */
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('authorize_button').style.visibility = 'visible';
    }
}

/**
 * Manipula a autenticação do usuário ao clicar no botão.
 */
function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        document.getElementById('signout_button').style.visibility = 'visible';
        document.getElementById('authorize_button').innerText = 'Refresh';
        
        // Mostrar as divs ao ser autenticado
        document.getElementById('criarReuniao').style.display = 'block';
        document.getElementById('agendas-list').style.display = 'block';
        document.getElementById('verificarReuniao').style.display = 'block';
        
        document.getElementById('criarReuniao_button').style.visibility = 'visible';
        document.getElementById('listar-agendas-btn').style.visibility = 'visible';
        
        await listUpcomingEvents();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

/**
 * Manipula o logout do usuário ao clicar no botão.
 */
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        document.getElementById('content').innerText = '';
        document.getElementById('authorize_button').innerText = 'Authorize';
        document.getElementById('signout_button').style.visibility = 'hidden';
        document.getElementById('listar-agendas-btn').style.visibility = 'hidden';
        document.getElementById('criarReuniao_button').style.visibility = 'hidden';
        
        // Esconder as divs ao deslogar
        document.getElementById('criarReuniao').style.display = 'none';
        document.getElementById('agendas-list').style.display = 'none';
        document.getElementById('verificarReuniao').style.display = 'none';
    }
}

/**
 * Adiciona rapidamente um evento ao calendário primário do usuário.
 */
async function criarReuniao() {
    const titulo = document.getElementById('titulo').value;
    const dataInicio = document.getElementById('dataInicio').value;
    const horaInicio = document.getElementById('horaInicio').value;
    const horaFim = document.getElementById('horaFim').value;
    const participantes = document.getElementById('participantes').value.split(',').map(email => email.trim());

    const emailUsuario = participantes[0]; // Supondo que o primeiro participante é o organizador
    const dataCalendarUsuario = new Date(dataInicio);
    const horariosReunioes = await obterHorariosReunioes(emailUsuario, dataCalendarUsuario);

    const inicioNovoEvento = new Date(`${dataInicio}T${horaInicio}:00-03:00`);
    const fimNovoEvento = new Date(`${dataInicio}T${horaFim}:00-03:00`);

    // Verifica se há conflitos de horário
    const conflito = horariosReunioes.some(horario => {
        const inicioEventoExistente = horario.inicio;
        const fimEventoExistente = horario.fim;

        // Verifica se há sobreposição de horários
        if (
            (inicioNovoEvento >= inicioEventoExistente && inicioNovoEvento < fimEventoExistente) ||
            (fimNovoEvento > inicioEventoExistente && fimNovoEvento <= fimEventoExistente) ||
            (inicioNovoEvento <= inicioEventoExistente && fimNovoEvento >= fimEventoExistente)
        ) {
            return true; 
        }

        return false; 
    });

    if (conflito) {
        exibirMensagem('Conflito de horário: já existe uma reunião nesse horário.');
        return;
    }

    try {
    
        const evento = {
            summary: titulo,
            start: {
                dateTime: `${dataInicio}T${horaInicio}:00-03:00`,
                timeZone: 'America/Sao_Paulo'
            },
            end: {
                dateTime: `${dataInicio}T${horaFim}:00-03:00`,
                timeZone: 'America/Sao_Paulo'
            },
            attendees: participantes.map(email => ({ email })),
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 15 }
                ]
            }
        };

       
        const resposta = await gapi.client.calendar.events.insert({
            calendarId: 'primary',
            resource: evento
        });

        console.log('Reunião criada com sucesso:', resposta.result.htmlLink);
        exibirMensagem('Reunião criada com sucesso. Link: ' + resposta.result.htmlLink);
        return resposta.result;
    } catch (erro) {
        console.error('Erro ao criar a reunião:', erro);
        exibirMensagem('Erro ao criar a reunião. Verifique o console para mais detalhes.');
        return null;
    }
}



/**
 * Função para listar agendas.
 */
async function listarAgendas() {
    try {
        const resposta = await gapi.client.calendar.calendarList.list();
        const agendas = resposta.result.items;

        if (agendas.length) {
            console.log("Suas agendas disponíveis:");
            agendas.forEach((agenda) => {
                console.log("- " + agenda.summary);
            });
        } else {
            console.log("Você não possui agendas.");
        }

        return agendas;
    } catch (erro) {
        console.error("Ocorreu um erro ao listar as agendas:", erro);
        return [];
    }
}
/**
 * Função para retornar o horario de reunioes especificas
 */
async function obterHorariosReunioes(emailUsuario, data) {
    try {
        
        const dataFormatada = data.toISOString().slice(0, 10);
        const timeMin = `${dataFormatada}T00:00:00Z`;
        const timeMax = `${dataFormatada}T23:59:59Z`;

        
        const resposta = await gapi.client.calendar.events.list({
            calendarId: emailUsuario,
            timeMin: timeMin,
            timeMax: timeMax,
            singleEvents: true,
            orderBy: 'startTime'
        });

        
        const horariosReunioes = [];

        
        for (const evento of resposta.result.items) {
            const inicioEvento = new Date(evento.start.dateTime);
            const fimEvento = new Date(evento.end.dateTime);

            horariosReunioes.push({ inicio: inicioEvento, fim: fimEvento });
        }

        return horariosReunioes;

    } catch (erro) {
        console.error('Erro ao obter horários de reuniões:', erro);
        return []; 
    }
}

/**
 * Tratar o retorno das agendas retornadas
 */
function mostrarAgendas() {
    listarAgendas().then((agendas) => {
        const agendasContainer = document.getElementById('agendas-list');

        if (agendas.length) {
            agendasContainer.innerHTML = '<h3>Suas agendas disponíveis:</h3>';
            const ul = document.createElement('ul');

            agendas.forEach((agenda) => {
                const li = document.createElement('li');
                li.textContent = agenda.summary;
                ul.appendChild(li);
            });

            agendasContainer.appendChild(ul);
        } else {
            agendasContainer.textContent = 'Você não possui agendas.';
        }
    }).catch((erro) => {
        console.error('Ocorreu um erro ao listar as agendas:', erro);
    });
}
const btnListarAgendas = document.getElementById('listar-agendas-btn');
    btnListarAgendas.addEventListener('click', mostrarAgendas);

function exibirMensagem(mensagem) {
    const modal = document.getElementById('messageModal');
    const span = document.getElementsByClassName('close')[0];
    const modalMessage = document.getElementById('modalMessage');

    modalMessage.textContent = mensagem;
    modal.style.display = 'block';

    span.onclick = function() {
        modal.style.display = 'none';
    };

    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

async function encontrarReuniao(identificador) {
    try {
        // Realiza uma consulta na API do Google Calendar para buscar o evento
        const resposta = await gapi.client.calendar.events.get({
            calendarId: 'primary', // Ou o ID da agenda específica
            eventId: identificador // Pode ser o ID do evento, nome (summary) ou email de participante
        });

        if (resposta.status === 200) {
            return resposta.result; // Retorna o objeto do evento encontrado
        } else {
            console.error('Erro ao encontrar a reunião:', resposta);
            return null;
        }
    } catch (erro) {
        console.error('Erro ao encontrar a reunião:', erro);
        return null;
    }
}
async function atualizarReuniao(identificador, novaData, novoHorarioInicio, novoHorarioFim) {
    try {
        // Busca a reunião com o identificador fornecido
        const reuniao = await encontrarReuniao(identificador);

        if (!reuniao) {
            console.error("Reunião não encontrada.");
            return;
        }

        // Atualiza a data e horário da reunião
        reuniao.start.dateTime = `${novaData}T${novoHorarioInicio}:00-03:00`;
        reuniao.end.dateTime = `${novaData}T${novoHorarioFim}:00-03:00`;

        // Utiliza a API do Google Calendar para atualizar a reunião
        const resposta = await gapi.client.calendar.events.update({
            calendarId: 'primary', // Ou o ID da agenda específica
            eventId: reuniao.id,
            resource: reuniao
        });

        console.log('Reunião atualizada com sucesso:', resposta.result.htmlLink);
    } catch (erro) {
        console.error('Erro ao atualizar a reunião:', erro);
    }
}

async function listarReunioesAtivas(emailUsuario, data) {
    try {
        // Formata a data para o formato aceito pela API (YYYY-MM-DD)
        const dataFormatada = data.toISOString().slice(0, 10); 
        const timeMin = `${dataFormatada}T00:00:00Z`;
        const timeMax = `${dataFormatada}T23:59:59Z`;

        // Chama a API para listar os eventos do dia
        const resposta = await gapi.client.calendar.events.list({
            calendarId: 'primary', // Substitua por 'emailUsuario' se quiser buscar em uma agenda específica
            timeMin: timeMin,
            timeMax: timeMax,
            singleEvents: true,
            orderBy: 'startTime'
        });

        // Filtra os eventos para retornar apenas os que o usuário participa
        const reunioesAtivas = resposta.result.items.filter(evento => {
            return evento.attendees && evento.attendees.some(participante => participante.email === emailUsuario);
        });

        // Formata a resposta para retornar título, data/hora e participantes
        return reunioesAtivas.map(evento => ({
            titulo: evento.summary,
            inicio: evento.start.dateTime,
            fim: evento.end.dateTime,
            participantes: evento.attendees.map(participante => participante.email)
        }));

    } catch (erro) {
        console.error('Erro ao listar reuniões ativas:', erro);
        return []; // Retorna um array vazio em caso de erro
    }
}

async function buscarReunioes() {
    const emailUsuario = document.getElementById('emailUsuario').value;
    const dataReuniao = new Date(document.getElementById('dataReuniao').value);

    if (!emailUsuario || !dataReuniao) {
        alert('Por favor, preencha o email e a data.');
        return;
    }

    const reunioes = await listarReunioesAtivas(emailUsuario, dataReuniao);

    // Aqui você pode exibir as reuniões na página, por exemplo, em uma lista
    const listaReunioes = document.getElementById('listaReunioes'); // Substitua pelo ID do elemento onde você quer exibir a lista
    listaReunioes.innerHTML = ''; // Limpa a lista anterior

    if (reunioes.length === 0) {
        listaReunioes.innerHTML = '<p>Nenhuma reunião encontrada para este dia.</p>';
    } else {
        reunioes.forEach(reuniao => {
            const itemLista = document.createElement('li');
            itemLista.innerHTML = `
                <b>${reuniao.titulo}</b><br>
                Início: ${reuniao.inicio}<br>
                Fim: ${reuniao.fim}<br>
                Participantes: ${reuniao.participantes.join(', ')}
            `;
            listaReunioes.appendChild(itemLista);
        });
    }
}