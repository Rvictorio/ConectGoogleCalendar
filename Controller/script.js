const CLIENT_ID = '180232621156-t6romfde6nvdtuab3k8mlc35t2u045tf.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDLjC4QyhtwwxcpNxLnglpcGpVKNPzS9yE';

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events';

let tokenClient;
let gapiInited = false;
let gisInited = false;

document.getElementById('authorize_button').style.visibility = 'hidden';
document.getElementById('signout_button').style.visibility = 'hidden';
document.getElementById('criarReuniao_button').style.visibility = 'hidden';
document.getElementById('listar-agendas-btn').style.visibility = 'hidden';

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
        document.getElementById('criarReuniao_button').style.visibility = 'visible';
        document.getElementById('listar-agendas-btn').style.visibility = 'visible';
        document.getElementById('authorize_button').innerText = 'Refresh';
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

function exibirMensagem(mensagem) {
    document.getElementById('mensagem').textContent = mensagem;
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
