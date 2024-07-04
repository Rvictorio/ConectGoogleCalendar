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

    try {
        // Crie o objeto do evento
        const evento = {
            summary: titulo,
            start: {
                dateTime: `${dataInicio}T${horaInicio}:00-03:00`, // Formato: 'YYYY-MM-DDTHH:mm:ss' com fuso horário fixo para São Paulo
                timeZone: 'America/Sao_Paulo'
            },
            end: {
                dateTime: `${dataInicio}T${horaFim}:00-03:00`, // Formato: 'YYYY-MM-DDTHH:mm:ss' com fuso horário fixo para São Paulo
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

        // Crie a reunião
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

// Função para exibir mensagens
function exibirMensagem(mensagem) {
    document.getElementById('mensagem').textContent = mensagem;
}

// Função para exibir mensagens
function exibirMensagem(mensagem) {
    document.getElementById('mensagem').textContent = mensagem;
}



// Função para listar as agendas do Google Calendar
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
  
  // Manipular o resultado da função listarAgendas()
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
  
  // Associar o evento de clique ao botão
  const btnListarAgendas = document.getElementById('listar-agendas-btn');
  btnListarAgendas.addEventListener('click', mostrarAgendas);

  // Função para verificar se há reuniões marcadas em um dia específico
async function verificarReunioesNoDia(data) {
    try {
        // Formata a data para o formato usado pela API (YYYY-MM-DD)
        const dataFormatada = data.toISOString().slice(0, 10);
        const timeMin = `${dataFormatada}T00:00:00Z`;
        const timeMax = `${dataFormatada}T23:59:59Z`;

        // Faz a requisição para listar os eventos do dia
        const resposta = await gapi.client.calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin,
            timeMax: timeMax,
            singleEvents: true,
            orderBy: 'startTime'
        });

        // Retorna true se houver eventos, false caso contrário
        return resposta.result.items.length > 0;

    } catch (erro) {
        console.error('Erro ao verificar reuniões:', erro);
        return false; // Ou você pode lançar um erro para tratamento posterior
    }
}

// Exemplo de utilização da função verificarReunioesNoDia
const dataEscolhida = new Date('2023-12-20'); // Substitua pela data desejada
verificarReunioesNoDia(dataEscolhida)
    .then(temReunioes => {
        if (temReunioes) {
            console.log('Existem reuniões marcadas neste dia.');
            // Faça algo aqui, por exemplo, exibir uma mensagem ao usuário
        } else {
            console.log('Não há reuniões marcadas neste dia.');
            // Faça algo aqui, por exemplo, permitir que o usuário crie uma reunião
        }
    });