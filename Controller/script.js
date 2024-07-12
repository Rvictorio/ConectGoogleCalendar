const CLIENT_ID = '180232621156-t6romfde6nvdtuab3k8mlc35t2u045tf.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDLjC4QyhtwwxcpNxLnglpcGpVKNPzS9yE';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events';

let tokenClient;
let gapiInited = false;
let gisInited = false;

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (resp) => {
            if (resp.error !== undefined) {
                throw (resp);
            }
            localStorage.setItem('google_token', JSON.stringify(gapi.client.getToken()));
            onSignIn();
        },
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        const storedToken = JSON.parse(localStorage.getItem('google_token'));
        if (storedToken) {
            gapi.client.setToken(storedToken);
            onSignIn();
        } else {
            document.getElementById('authorize_button').style.visibility = 'visible';
        }
    }
}

function handleAuthClick() {
    tokenClient.requestAccessToken({ prompt: '' });
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken('');
            localStorage.removeItem('google_token');
            onSignOut();
        });
    }
}

function onSignIn() {
    document.getElementById('signout_button').style.visibility = 'visible';
    document.getElementById('authorize_button').style.visibility = 'hidden';
    document.getElementById('criarReuniao').style.display = 'block';
    document.getElementById('agendas-list').style.display = 'block';
    document.getElementById('verificarReuniao').style.display = 'block';
    listarReunioesAtivas();
}

function onSignOut() {
    document.getElementById('signout_button').style.visibility = 'hidden';
    document.getElementById('authorize_button').style.visibility = 'visible';
    document.getElementById('criarReuniao').style.display = 'none';
    document.getElementById('agendas-list').style.display = 'none';
    document.getElementById('verificarReuniao').style.display = 'none';
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

async function listarReunioesAtivas(emailUsuario, data) {
    try {
        
        const dataFormatada = data.toISOString().slice(0, 10); 
        const timeMin = `${dataFormatada}T00:00:00Z`;
        const timeMax = `${dataFormatada}T23:59:59Z`;

        // Chama a API para listar os eventos do dia
        const resposta = await gapi.client.calendar.events.list({
            calendarId: 'primary', 
            timeMin: timeMin,
            timeMax: timeMax,
            singleEvents: true,
            orderBy: 'startTime'
        });

        
        const reunioesAtivas = resposta.result.items.filter(evento => {
            return evento.attendees && evento.attendees.some(participante => participante.email === emailUsuario);
        });

       
        return reunioesAtivas.map(evento => {
            console.log('Evento:', evento); // Verifique se `evento.id` está presente
            return {
                eventId: evento.id,
                titulo: evento.summary,
                inicio: evento.start.dateTime,
                fim: evento.end.dateTime,
                participantes: evento.attendees.map(participante => participante.email)
            };
        });

    } catch (erro) {
        console.error('Erro ao listar reuniões ativas:', erro);
        return []; 
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

    if (reunioes.length === 0) {
        alert('Nenhuma reunião encontrada');        
    }  else {
        reunioes.forEach((reuniao, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${reuniao.titulo} (Início: ${reuniao.inicio})`;
            listaReunioes.appendChild(option);
        });

        listaReunioes.addEventListener('change', (event) => {
            const reuniaoSelecionada = reunioes[event.target.value];
            document.getElementById('eventId').value = reuniaoSelecionada.eventId;
            document.getElementById('tituloAtualizacao').value = reuniaoSelecionada.titulo;
            document.getElementById('dataAtualizacao').value = reuniaoSelecionada.inicio.split('T')[0];
            document.getElementById('horaInicioAtualizacao').value = reuniaoSelecionada.inicio.split('T')[1].substring(0, 5);
            document.getElementById('horaFimAtualizacao').value = reuniaoSelecionada.fim.split('T')[1].substring(0, 5);
            document.getElementById('participantesAtualizacao').value = reuniaoSelecionada.participantes.join(', ');
            document.getElementById('localAtualizacao').value = reuniaoSelecionada.local || '';
            document.getElementById('descricaoAtualizacao').value = reuniaoSelecionada.descricao || '';
        });
    }
}


// async function atualizarReuniao(identificador, novaData, novoHorarioInicio, novoHorarioFim) {
//     try { 

//         if (!reuniao) {
//             console.error("Reunião não encontrada.");
//             return;
//         }

        
//         reuniao.start.dateTime = `${novaData}T${novoHorarioInicio}:00-03:00`;
//         reuniao.end.dateTime = `${novaData}T${novoHorarioFim}:00-03:00`;

       
//         const resposta = await gapi.client.calendar.events.update({ 
//             eventId: evento.id,
//             titulo: evento.summary,
//             inicio: evento.start.dateTime,
//             fim: evento.end.dateTime,
//             participantes: evento.attendees.map(participante => participante.email)
//         });

//         console.log('Reunião atualizada com sucesso:', resposta.result.htmlLink);
//     } catch (erro) {
//         console.error('Erro ao atualizar a reunião:', erro);
//     }
// }


//   async function encontrarReuniao(identificador) {
//     try {
//         const resposta = await gapi.client.calendar.events.get({
//             calendarId: 'primary', 
//             eventId: identificador 
//         });

//         if (resposta.status === 200) {
//             return resposta.result; 
//         } else {
//             console.error('Erro ao encontrar a reunião:', resposta);
//             return null;
//         }
//     } catch (erro) {
//         console.error('Erro ao encontrar a reunião:', erro);
//         return null;
//     }
// }



