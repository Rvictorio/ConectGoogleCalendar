const CLIENT_ID = '180232621156-t6romfde6nvdtuab3k8mlc35t2u045tf.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDLjC4QyhtwwxcpNxLnglpcGpVKNPzS9yE';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.profile';

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
            setCookie('google_token', JSON.stringify(gapi.client.getToken()), 1);
            await fetchUserProfile();
            onSignIn();
        },
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        const storedToken = getCookie('google_token');
        if (storedToken) {
            gapi.client.setToken(JSON.parse(storedToken));
            fetchUserProfile().then(onSignIn);
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
            deleteCookie('google_token');
            onSignOut();
        });
    }
}

async function fetchUserProfile() {
    await gapi.client.request({
        'path': 'https://www.googleapis.com/oauth2/v1/userinfo',
        'params': { 'alt': 'json' }
    }).then(response => {
        const profile = response.result;
        document.getElementById('user_name').innerText = profile.name;
        document.getElementById('user_image').src = profile.picture;
    });
}

function onSignIn() {
    document.getElementById('signout_button').style.visibility = 'visible';
    document.getElementById('authorize_button').style.visibility = 'hidden';
    document.getElementById('criarReuniao').style.display = 'block';
    document.getElementById('user_info').style.display = 'block';
    listarReunioesAtivas();
}

function onSignOut() {
    document.getElementById('signout_button').style.visibility = 'hidden';
    document.getElementById('authorize_button').style.visibility = 'visible';
    document.getElementById('criarReuniao').style.display = 'none';
    document.getElementById('agendas-list').style.display = 'none';
    document.getElementById('verificarReuniao').style.display = 'none';
    document.getElementById('user_info').style.display = 'none';
}

// Funções auxiliares para manipulação de cookies
function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + d.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function getCookie(name) {
    const cname = name + "=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(cname) === 0) {
            return c.substring(cname.length, c.length);
        }
    }
    return "";
}

function deleteCookie(name) {
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/';
}

// Chamar essas funções no carregamento da página
window.onload = function() {
    gapiLoaded();
    gisLoaded();
};


/**
 * Adiciona rapidamente um evento ao calendário primário do usuário.
 */
async function criarReuniao() {
    const titulo = document.getElementById('titulo').value;
    const dataInicio = document.getElementById('dataInicio').value;
    const horaInicio = document.getElementById('horaInicio').value;
    const horaFim = document.getElementById('horaFim').value;
    const participantes = document.getElementById('participantes').value.split(',').map(email => email.trim());

    const emailUsuario = participantes[0]; 
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
       exibirMensagem('Erro ao obter horários de reuniões:', erro);
        return []; 
    }
}
/**
 * Função para retornar as mensagens das funções
 */
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

/**
 * Função para validar as reunioes ativas em dias especificos
 */
async function  listarReunioesAtivas(emailUsuario, data) {
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

/**
 * Função para buscar reunioes ativas
 */
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

/**
 * Função para atualizar reuniões já criadas
 */
async function atualizarReuniao() {
    try {
        const eventId = document.getElementById('eventId').value;
        const tituloAtualizacao = document.getElementById('tituloAtualizacao').value;
        const dataAtualizacao = document.getElementById('dataAtualizacao').value;
        const horaInicioAtualizacao = document.getElementById('horaInicioAtualizacao').value;
        const horaFimAtualizacao = document.getElementById('horaFimAtualizacao').value;
        const participantesAtualizacao = document.getElementById('participantesAtualizacao').value.split(',').map(email => email.trim());
        const localAtualizacao = document.getElementById('localAtualizacao').value;
        const descricaoAtualizacao = document.getElementById('descricaoAtualizacao').value;

        const evento = {
            summary: tituloAtualizacao,
            start: {
                dateTime: `${dataAtualizacao}T${horaInicioAtualizacao}:00-03:00`,
                timeZone: 'America/Sao_Paulo'
            },
            end: {
                dateTime: `${dataAtualizacao}T${horaFimAtualizacao}:00-03:00`,
                timeZone: 'America/Sao_Paulo'
            },
            attendees: participantesAtualizacao.map(email => ({ email })),
            location: localAtualizacao,
            description: descricaoAtualizacao,
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 15 }
                ]
            }
        };

        const resposta = await gapi.client.calendar.events.update({
            calendarId: 'primary',
            eventId: eventId, 
            resource: evento
        });

        exibirMensagem('Reunião atualizada com sucesso:', resposta.result.htmlLink);
       
    } catch (erro) {
        exibirMensagem('Erro ao atualizar a reunião:', erro);
    }
}
/**
 * Função que lista reunioes para delete
 */

async function listarReunioesDelete() {
    const emailUsuario = document.getElementById('emailUsuarioDeletar').value;
    const dataReuniao = new Date(document.getElementById('dataReuniaoDeletar').value);

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
            listaReunioesDeletar.appendChild(option);
        });

        listaReunioesDeletar.addEventListener('change', (event) => {
            const reuniaoSelecionada = reunioes[event.target.value];
            document.getElementById('eventIdDeletar').value = reuniaoSelecionada.eventId;
            document.getElementById('participantesDeletar').value = reuniaoSelecionada.participantes;
            document.getElementById('dataDeletar').value = reuniaoSelecionada.inicio.split('T')[0];   
        });

    }
}

/**
 * Função para deletar reuniões
 */
async function deletarReuniao(){
    eventIdDeletar = document.getElementById('eventIdDeletar').value

    try {
      const resposta=  await gapi.client.calendar.events.delete({
        calendarId: 'primary', 
        eventId : eventIdDeletar
        });
        exibirMensagem('Evento excluído com sucesso!');
      } catch (error) {
        exibirMensagem('Erro ao excluir evento:', error);
      }
}


async function criarAgenda() {
    const nome = document.getElementById('nomeAgenda').value;
    

    try {
       
        const respostaCriacao = await gapi.client.calendar.calendars.insert({
            resource: {
                summary: nome,
            }
        });

        
        exibirMensagem('Agenda criada com sucesso!', respostaCriacao.result);

    } catch (error) {
        
        exibirMensagem('Erro ao criar agenda ou delegar permissões: ' + error.message);
        console.error('Erro detalhado:', error);
    }
}

async function delegarPermissao() {
     const emailDelegado = document.getElementById('emailDelegado').value;
     const nomeAgenda = document.getElementById('nomeAgenda').value;
    try{
    const regraAcesso = {
        scope: {
            type: 'user',
            value: emailDelegado
        },
        role: 'writer'
    };
    const respostaDelegacao = await gapi.client.calendar.acl.insert({
        calendarId: nomeAgenda,
        resource: regraAcesso
    });
    exibirMensagem('Permissões delegadas com sucesso!');

}
catch (error) {
    exibirMensagem('Erro ao criar agenda ou delegar permissões: ' + error.message);

}
}



async function listarAgendasAtivas() {
    try {
        const resposta = await gapi.client.calendar.calendarList.list({
            minAccessRole: 'owner' 
        });

        const agendas = resposta.result.items;

        
        const dropdown = document.getElementById('dropdownAgendas');
        dropdown.innerHTML = ''; // Limpar opções existentes

        agendas.forEach(agenda => {
            const option = document.createElement('option');
            option.value = agenda.id;
            option.textContent = agenda.summary;
            dropdown.appendChild(option);
        });

        return agendas;
    } catch (error) {
        console.error('Erro ao listar agendas:', error);
       
    }
}


  async function alterarReuniao(idAgenda, novasInformacoes) {
    try {
      const resposta = await gapi.client.calendar.events.patch({
        calendarId: idAgenda,
        eventId: idDaReuniao, // Você precisa obter o ID da reunião que será alterada
        resource: novasInformacoes
      });
  
      console.log('Reunião alterada com sucesso:', resposta.result);
      // Exiba uma mensagem de sucesso para o usuário
    } catch (error) {
      console.error('Erro ao alterar reunião:', error);
      // Trate o erro de forma apropriada
    }
  }