function lerArmazenamentoLocal(chave, valorPadrao) {
  try {
    const valor = window.localStorage.getItem(chave);
    return {
      data: valor ? JSON.parse(valor) : valorPadrao,
      error: null
    };
  } catch (error) {
    console.error('Erro ao ler dados locais:', error);
    return { data: null, error: error };
  }
}

function salvarArmazenamentoLocal(chave, valor) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
    return { error: null };
  } catch (error) {
    console.error('Erro ao salvar dados locais:', error);
    return { error: error };
  }
}

function modoTesteLocal() {
  return typeof window !== 'undefined' && window.FINANCAPP_LOCAL_TEST_MODE === true;
}

function garantirUsuarioDemonstracao() {
  const resultadoUsuarios = lerArmazenamentoLocal('financapp_usuarios', []);
  if (resultadoUsuarios.error) {
    return { error: resultadoUsuarios.error };
  }
  if (!Array.isArray(resultadoUsuarios.data)) {
    return { error: { message: 'Os dados locais de usuários estão inválidos.' } };
  }

  const existe = resultadoUsuarios.data.some(function (usuario) {
    return String(usuario.usuario).toLowerCase() === 'demo';
  });
  if (existe) return { error: null };

  resultadoUsuarios.data.push({
    id: 'demo-' + Math.random().toString(36).slice(2),
    nome: 'Usuário de demonstração',
    turma: 'Teste',
    usuario: 'demo',
    senha: 'demo1234',
    criado_em: new Date().toISOString()
  });
  return salvarArmazenamentoLocal('financapp_usuarios', resultadoUsuarios.data);
}

async function cadastrarUsuario(nome, turma, usuario, senha) {
  const usuarioNormalizado = String(usuario || '').trim();
  const senhaNormalizada = String(senha || '');

  if (!usuarioNormalizado || !senhaNormalizada) {
    return { data: null, error: { message: 'Usuário e senha são obrigatórios.' } };
  }

  if (modoTesteLocal()) {
    const resultadoUsuarios = lerArmazenamentoLocal('financapp_usuarios', []);
    if (resultadoUsuarios.error) {
      return { data: null, error: resultadoUsuarios.error };
    }
    if (!Array.isArray(resultadoUsuarios.data)) {
      return { data: null, error: { message: 'Os dados locais de usuários estão inválidos.' } };
    }

    const usuarios = resultadoUsuarios.data;
    const jaExiste = usuarios.some(function (item) {
      return String(item.usuario).toLowerCase() === usuarioNormalizado.toLowerCase();
    });

    if (jaExiste) {
      return { data: null, error: { message: 'Usuário já cadastrado.' } };
    }

    const novoUsuario = {
      id: Date.now().toString() + '-' + Math.random().toString(36).slice(2),
      nome: String(nome || '').trim(),
      turma: String(turma || '').trim(),
      usuario: usuarioNormalizado,
      senha: senhaNormalizada,
      criado_em: new Date().toISOString()
    };

    usuarios.push(novoUsuario);
    const salvamentoUsuarios = salvarArmazenamentoLocal('financapp_usuarios', usuarios);
    if (salvamentoUsuarios.error) {
      return { data: null, error: salvamentoUsuarios.error };
    }

    const salvamentoSessao = salvarArmazenamentoLocal('financapp_usuario_atual', novoUsuario);
    if (salvamentoSessao.error) {
      return { data: null, error: salvamentoSessao.error };
    }

    return { data: novoUsuario, error: null };
  }

  const { data, error } = await supabaseClient
    .from('usuarios')
    .insert([{
      nome: String(nome || '').trim(),
      turma: String(turma || '').trim(),
      usuarios: usuarioNormalizado,
      senha: senhaNormalizada
    }])
    .select('id, nome, turma, usuarios')
    .single();

  if (error) {
    console.error(error);
    return { data: null, error: error };
  }

  const usuarioSessao = Object.assign({}, data, { _origem: 'supabase' });
  const salvamentoSessao = salvarArmazenamentoLocal('financapp_usuario_atual', usuarioSessao);
  if (salvamentoSessao.error) {
    return { data: null, error: salvamentoSessao.error };
  }

  console.log('Usuário cadastrado no Supabase.');
  return { data: usuarioSessao, error: null };
}

async function fazerLogin(usuario, senha) {
  const usuarioNormalizado = String(usuario || '').trim();
  const senhaNormalizada = String(senha || '');

  if (modoTesteLocal()) {
    const resultadoUsuarios = lerArmazenamentoLocal('financapp_usuarios', []);
    if (resultadoUsuarios.error) {
      return { data: null, error: resultadoUsuarios.error };
    }
    if (!Array.isArray(resultadoUsuarios.data)) {
      return { data: null, error: { message: 'Os dados locais de usuários estão inválidos.' } };
    }

    const usuarios = resultadoUsuarios.data;
    const usuarioEncontrado = usuarios.find(function (item) {
      return String(item.usuario).toLowerCase() === usuarioNormalizado.toLowerCase()
        && String(item.senha) === senhaNormalizada;
    });

    if (!usuarioEncontrado) {
      return { data: null, error: { message: 'Usuário ou senha incorretos.' } };
    }

    const salvamentoSessao = salvarArmazenamentoLocal('financapp_usuario_atual', usuarioEncontrado);
    if (salvamentoSessao.error) {
      return { data: null, error: salvamentoSessao.error };
    }
    console.log('Login ok (modo teste).');
    return { data: usuarioEncontrado, error: null };
  }

  const { data, error } = await supabaseClient
    .from('usuarios')
    .select('id, nome, turma, usuarios')
    .eq('usuarios', usuarioNormalizado)
    .eq('senha', senhaNormalizada)
    .maybeSingle();

  if (error) {
    console.error(error);
    return { data: null, error: error };
  }

  if (!data) {
    return { data: null, error: { message: 'Usuário ou senha incorretos.' } };
  }

  const usuarioSessao = Object.assign({}, data, { _origem: 'supabase' });
  const salvamentoSessao = salvarArmazenamentoLocal('financapp_usuario_atual', usuarioSessao);
  if (salvamentoSessao.error) {
    return { data: null, error: salvamentoSessao.error };
  }

  console.log('Login ok.');
  return { data: usuarioSessao, error: null };
}

async function criarLancamento(autorId, descricao, valor, tipo) {
  if (modoTesteLocal()) {
    const descricaoNormalizada = String(descricao || '').trim();
    const valorNumerico = Number(valor);
    const tipoNormalizado = String(tipo || '').trim().toLowerCase();

    if (!descricaoNormalizada) {
      return { data: null, error: { message: 'A descrição do lançamento é obrigatória.' } };
    }
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return { data: null, error: { message: 'O valor deve ser um número maior que zero.' } };
    }
    if (tipoNormalizado !== 'receita' && tipoNormalizado !== 'despesa') {
      return { data: null, error: { message: 'O tipo deve ser receita ou despesa.' } };
    }

    const resultadoSessao = lerArmazenamentoLocal('financapp_usuario_atual', null);
    if (resultadoSessao.error) {
      return { data: null, error: resultadoSessao.error };
    }
    const autorAtualId = autorId || (resultadoSessao.data && resultadoSessao.data.id);
    if (!autorAtualId) {
      return { data: null, error: { message: 'Faça login antes de criar um lançamento.' } };
    }

    const resultadoLancamentos = lerArmazenamentoLocal('financapp_lancamentos', []);
    if (resultadoLancamentos.error) {
      return { data: null, error: resultadoLancamentos.error };
    }
    if (!Array.isArray(resultadoLancamentos.data)) {
      return { data: null, error: { message: 'Os dados locais de lançamentos estão inválidos.' } };
    }

    const lancamento = {
      id: Date.now().toString() + '-' + Math.random().toString(36).slice(2),
      autor_id: autorAtualId,
      descricao: descricaoNormalizada,
      valor: valorNumerico,
      tipo: tipoNormalizado,
      criado_em: new Date().toISOString(),
      tags: []
    };
    resultadoLancamentos.data.push(lancamento);

    const salvamento = salvarArmazenamentoLocal('financapp_lancamentos', resultadoLancamentos.data);
    if (salvamento.error) {
      return { data: null, error: salvamento.error };
    }

    return { data: lancamento, error: null };
  }

  const { data, error } = await supabaseClient
    .from('lancamentos')
    .insert([{ autor_id: autorId, descricao: descricao, valor: Number(valor), tipo: tipo }])
    .select()
    .single();

  if (error) {
    console.error(error);
    return { data: null, error: error };
  }

  console.log('Lançamento criado:', data);
  return { data: data, error: null };
}

async function editarLancamento(lancamentoId, autorId, descricao, valor, tipo) {
  const descricaoNormalizada = String(descricao || '').trim();
  const valorNumerico = Number(valor);
  const tipoNormalizado = String(tipo || '').trim().toLowerCase();

  if (!descricaoNormalizada) {
    return { data: null, error: { message: 'A descrição do lançamento é obrigatória.' } };
  }
  if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
    return { data: null, error: { message: 'O valor deve ser um número maior que zero.' } };
  }
  if (tipoNormalizado !== 'receita' && tipoNormalizado !== 'despesa') {
    return { data: null, error: { message: 'O tipo deve ser receita ou despesa.' } };
  }

  if (modoTesteLocal()) {
    const resultadoLancamentos = lerArmazenamentoLocal('financapp_lancamentos', []);
    if (resultadoLancamentos.error) {
      return { data: null, error: resultadoLancamentos.error };
    }
    if (!Array.isArray(resultadoLancamentos.data)) {
      return { data: null, error: { message: 'Os dados locais de lançamentos estão inválidos.' } };
    }

    const lancamento = resultadoLancamentos.data.find(function (item) {
      return String(item.id) === String(lancamentoId)
        && String(item.autor_id) === String(autorId);
    });
    if (!lancamento) {
      return { data: null, error: { message: 'Lançamento não encontrado.' } };
    }

    lancamento.descricao = descricaoNormalizada;
    lancamento.valor = valorNumerico;
    lancamento.tipo = tipoNormalizado;

    const salvamento = salvarArmazenamentoLocal('financapp_lancamentos', resultadoLancamentos.data);
    if (salvamento.error) {
      return { data: null, error: salvamento.error };
    }
    return { data: lancamento, error: null };
  }

  const { data, error } = await supabaseClient
    .from('lancamentos')
    .update({
      descricao: descricaoNormalizada,
      valor: valorNumerico,
      tipo: tipoNormalizado
    })
    .eq('id', lancamentoId)
    .eq('autor_id', autorId)
    .select()
    .single();

  if (error) {
    console.error(error);
    return { data: null, error: error };
  }

  return { data: data, error: null };
}

async function excluirLancamento(lancamentoId, autorId) {
  if (modoTesteLocal()) {
    const resultadoLancamentos = lerArmazenamentoLocal('financapp_lancamentos', []);
    if (resultadoLancamentos.error) {
      return { data: null, error: resultadoLancamentos.error };
    }
    if (!Array.isArray(resultadoLancamentos.data)) {
      return { data: null, error: { message: 'Os dados locais de lançamentos estão inválidos.' } };
    }

    const indice = resultadoLancamentos.data.findIndex(function (item) {
      return String(item.id) === String(lancamentoId)
        && String(item.autor_id) === String(autorId);
    });
    if (indice === -1) {
      return { data: null, error: { message: 'Lançamento não encontrado.' } };
    }

    const removido = resultadoLancamentos.data.splice(indice, 1)[0];
    const salvamento = salvarArmazenamentoLocal('financapp_lancamentos', resultadoLancamentos.data);
    if (salvamento.error) {
      return { data: null, error: salvamento.error };
    }
    return { data: removido, error: null };
  }

  const { data, error } = await supabaseClient
    .from('lancamentos')
    .delete()
    .eq('id', lancamentoId)
    .eq('autor_id', autorId)
    .select()
    .single();

  if (error) {
    console.error(error);
    return { data: null, error: error };
  }

  return { data: data, error: null };
}

function calcularRelatorioMensal(lancamentos, mes) {
  const transacoes = lancamentos
    .filter(function (lancamento) {
      return (lancamento.tipo === 'despesa' || lancamento.tipo === 'receita')
        && typeof lancamento.criado_em === 'string'
        && lancamento.criado_em.slice(0, 7) === mes;
    })
    .sort(function (a, b) {
      return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
    });

  const despesas = transacoes.filter(function (lancamento) {
    return lancamento.tipo === 'despesa';
  });
  const receitas = transacoes.filter(function (lancamento) {
    return lancamento.tipo === 'receita';
  });
  const totalDespesas = despesas.reduce(function (soma, lancamento) {
    return soma + Number(lancamento.valor);
  }, 0);
  const totalReceitas = receitas.reduce(function (soma, lancamento) {
    return soma + Number(lancamento.valor);
  }, 0);

  return {
    transacoes: transacoes,
    despesas: despesas,
    receitas: receitas,
    totalDespesas: totalDespesas,
    totalReceitas: totalReceitas,
    saldoPeriodo: totalReceitas - totalDespesas,
    quantidadeDespesas: despesas.length,
    quantidadeReceitas: receitas.length
  };
}

async function carregarLancamentos(autorId) {
  if (modoTesteLocal()) {
    const resultadoSessao = lerArmazenamentoLocal('financapp_usuario_atual', null);
    if (resultadoSessao.error) {
      return { data: [], error: resultadoSessao.error };
    }
    const autorAtualId = autorId || (resultadoSessao.data && resultadoSessao.data.id);
    if (!autorAtualId) {
      return { data: [], error: { message: 'Faça login para carregar os lançamentos.' } };
    }

    const resultadoLancamentos = lerArmazenamentoLocal('financapp_lancamentos', []);
    if (resultadoLancamentos.error) {
      return { data: [], error: resultadoLancamentos.error };
    }
    if (!Array.isArray(resultadoLancamentos.data)) {
      return { data: [], error: { message: 'Os dados locais de lançamentos estão inválidos.' } };
    }

    const lancamentos = resultadoLancamentos.data
      .filter(function (lancamento) {
        return String(lancamento.autor_id) === String(autorAtualId);
      })
      .sort(function (a, b) {
        return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
      });

    return { data: lancamentos, error: null };
  }

  const { data, error } = await supabaseClient
    .from('lancamentos')
    .select('*, lancamento_tags(tags(nome))')
    .eq('autor_id', autorId)
    .order('criado_em', { ascending: false });

  if (error) {
    console.error(error);
    return { data: [], error: error };
  }

  const lancamentos = (data || []).map(function (lancamento) {
    const tags = Array.isArray(lancamento.lancamento_tags)
      ? lancamento.lancamento_tags
          .map(function (lt) {
            return lt && lt.tags ? lt.tags.nome : null;
          })
          .filter(Boolean)
      : [];

    return Object.assign({}, lancamento, { tags: tags });
  });

  return { data: lancamentos, error: null };
}

async function adicionarTag(lancamentoId, nomeTag) {
  const nome = String(nomeTag ?? '').trim().toLowerCase();

  if (!nome) {
    return { data: null, error: { message: 'Tag vazia.' } };
  }

  if (modoTesteLocal()) {
    const resultadoLancamentos = lerArmazenamentoLocal('financapp_lancamentos', []);
    if (resultadoLancamentos.error) {
      return { data: null, error: resultadoLancamentos.error };
    }
    if (!Array.isArray(resultadoLancamentos.data)) {
      return { data: null, error: { message: 'Os dados locais de lançamentos estão inválidos.' } };
    }

    const lancamento = resultadoLancamentos.data.find(function (item) {
      return String(item.id) === String(lancamentoId);
    });
    if (!lancamento) {
      return { data: null, error: { message: 'Lançamento não encontrado.' } };
    }

    lancamento.tags = Array.isArray(lancamento.tags) ? lancamento.tags : [];
    if (lancamento.tags.includes(nome)) {
      return { data: lancamento, error: null };
    }
    lancamento.tags.push(nome);

    const salvamento = salvarArmazenamentoLocal('financapp_lancamentos', resultadoLancamentos.data);
    if (salvamento.error) {
      return { data: null, error: salvamento.error };
    }
    return { data: lancamento, error: null };
  }

  let tag = null;
  const busca = await supabaseClient
    .from('tags')
    .select('*')
    .eq('nome', nome)
    .maybeSingle();

  if (busca.error) {
    console.error(busca.error);
    return { data: null, error: busca.error };
  }

  tag = busca.data;

  if (!tag) {
    const criacao = await supabaseClient
      .from('tags')
      .insert({ nome: nome })
      .select()
      .single();

    if (criacao.error) {
      console.error(criacao.error);
      return { data: null, error: criacao.error };
    }

    tag = criacao.data;
  }

  const { data, error } = await supabaseClient
    .from('lancamento_tags')
    .insert([{ lancamento_id: lancamentoId, tag_id: tag.id }])
    .select();

  if (error) {
    if (error.code === '23505') {
      console.warn('Essa tag já estava nesse lançamento.');
      return { data: null, error: null };
    }

    console.error(error);
    return { data: null, error: error };
  }

  console.log('Tag adicionada:', data);
  return { data: data, error: null };
}

async function calcularSaldo(autorId) {
  const resultado = await carregarLancamentos(autorId);
  if (resultado.error) {
    return { data: null, error: resultado.error };
  }

  const saldo = resultado.data.reduce(function (total, lancamento) {
    const valor = Number(lancamento.valor);
    if (lancamento.tipo === 'receita') {
      return total + valor;
    }
    if (lancamento.tipo === 'despesa') {
      return total - valor;
    }
    return total;
  }, 0);

  return { data: saldo, error: null };
}

document.addEventListener('DOMContentLoaded', function () {
  const authView = document.getElementById('auth-view');
  const dashboardView = document.getElementById('dashboard-view');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const authMessage = document.getElementById('auth-message');
  const transactionForm = document.getElementById('transaction-form');
  const transactionMessage = document.getElementById('transaction-message');
  const transactionsList = document.getElementById('transactions-list');
  const balanceValue = document.getElementById('balance-value');
  const welcomeTitle = document.getElementById('welcome-title');
  const reportMonth = document.getElementById('report-month');
  const reportTotal = document.getElementById('report-total');
  const reportIncome = document.getElementById('report-income');
  const reportNet = document.getElementById('report-net');
  const reportCount = document.getElementById('report-count');
  const reportList = document.getElementById('report-list');
  const reportPrintUser = document.getElementById('report-print-user');
  const reportPrintPeriod = document.getElementById('report-print-period');
  let usuarioAtual = null;

  function mostrarMensagem(elemento, mensagem, sucesso) {
    elemento.textContent = mensagem || '';
    elemento.classList.toggle('success', Boolean(sucesso));
  }

  function alternarAba(aba) {
    const mostrarCadastro = aba === 'cadastro';
    loginForm.hidden = mostrarCadastro;
    registerForm.hidden = !mostrarCadastro;
    document.getElementById('login-tab').setAttribute('aria-selected', String(!mostrarCadastro));
    document.getElementById('register-tab').setAttribute('aria-selected', String(mostrarCadastro));
    document.getElementById('auth-title').textContent = mostrarCadastro ? 'Crie sua conta' : 'Acesse sua conta';
    mostrarMensagem(authMessage, '');
  }

  function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
  }

  function renderizarLancamentos(lancamentos) {
    transactionsList.replaceChildren();
    if (!lancamentos.length) {
      transactionsList.appendChild(criarElemento('p', 'empty', 'Nenhum lançamento por enquanto. Adicione seu primeiro lançamento.'));
      return;
    }

    lancamentos.forEach(function (lancamento) {
      const cartao = criarElemento('article', 'transaction');
      const topo = criarElemento('div', 'transaction-main');
      const detalhes = document.createElement('div');
      const descricao = criarElemento('div', 'transaction-name', lancamento.descricao);
      const data = new Date(lancamento.criado_em);
      const dataFormatada = Number.isNaN(data.getTime())
        ? 'Data indisponível'
        : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(data);
      detalhes.append(descricao, criarElemento('div', 'transaction-date', dataFormatada));

      const valor = Number(lancamento.valor);
      const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
      const montante = criarElemento(
        'div',
        'amount ' + (lancamento.tipo === 'receita' ? 'income' : 'expense'),
        (lancamento.tipo === 'receita' ? '+' : '−') + valorFormatado
      );
      topo.append(detalhes, montante);
      cartao.appendChild(topo);

      const formularioEdicao = criarElemento('form', 'edit-transaction-form');
      formularioEdicao.hidden = true;
      formularioEdicao.dataset.lancamentoId = lancamento.id;
      const camposEdicao = criarElemento('div', 'edit-fields');
      const descricaoEdicao = document.createElement('input');
      descricaoEdicao.name = 'descricao';
      descricaoEdicao.maxLength = 100;
      descricaoEdicao.required = true;
      descricaoEdicao.setAttribute('aria-label', 'Descrição do lançamento');
      descricaoEdicao.value = lancamento.descricao || '';
      const valorEdicao = document.createElement('input');
      valorEdicao.name = 'valor';
      valorEdicao.type = 'number';
      valorEdicao.min = '0.01';
      valorEdicao.step = '0.01';
      valorEdicao.required = true;
      valorEdicao.setAttribute('aria-label', 'Valor do lançamento');
      valorEdicao.value = String(lancamento.valor);
      const tipoEdicao = document.createElement('select');
      tipoEdicao.name = 'tipo';
      tipoEdicao.setAttribute('aria-label', 'Tipo do lançamento');
      [['despesa', 'Despesa'], ['receita', 'Receita']].forEach(function (opcao) {
        const elementoOpcao = document.createElement('option');
        elementoOpcao.value = opcao[0];
        elementoOpcao.textContent = opcao[1];
        tipoEdicao.appendChild(elementoOpcao);
      });
      tipoEdicao.value = lancamento.tipo;
      camposEdicao.append(descricaoEdicao, valorEdicao, tipoEdicao);
      const botoesEdicao = criarElemento('div', 'edit-actions');
      const salvarEdicao = criarElemento('button', 'button', 'Salvar');
      salvarEdicao.type = 'submit';
      const cancelarEdicao = criarElemento('button', 'button secondary', 'Cancelar');
      cancelarEdicao.type = 'button';
      cancelarEdicao.classList.add('cancel-edit-button');
      botoesEdicao.append(salvarEdicao, cancelarEdicao);
      formularioEdicao.append(camposEdicao, botoesEdicao);
      cartao.appendChild(formularioEdicao);

      const botaoEditar = criarElemento('button', 'button secondary edit-transaction-button', 'Editar');
      botaoEditar.type = 'button';
      botaoEditar.dataset.lancamentoId = lancamento.id;
      botaoEditar.setAttribute('aria-label', 'Editar lançamento: ' + lancamento.descricao);
      const botoesLancamento = criarElemento('div', 'transaction-actions');
      botoesLancamento.appendChild(botaoEditar);
      const botaoExcluir = criarElemento('button', 'button danger delete-transaction-button', 'Excluir');
      botaoExcluir.type = 'button';
      botaoExcluir.dataset.lancamentoId = lancamento.id;
      botaoExcluir.setAttribute('aria-label', 'Excluir lançamento: ' + lancamento.descricao);
      botoesLancamento.appendChild(botaoExcluir);
      cartao.appendChild(botoesLancamento);

      const tags = Array.isArray(lancamento.tags) ? lancamento.tags : [];
      if (tags.length) {
        const listaTags = criarElemento('div', 'tags');
        tags.forEach(function (tag) {
          listaTags.appendChild(criarElemento('span', 'tag', tag));
        });
        cartao.appendChild(listaTags);
      }

      const formularioTag = criarElemento('form', 'tag-form');
      formularioTag.dataset.lancamentoId = lancamento.id;
      const entradaTag = document.createElement('input');
      entradaTag.name = 'tag';
      entradaTag.maxLength = 40;
      entradaTag.placeholder = 'Adicionar tag';
      entradaTag.setAttribute('aria-label', 'Adicionar tag a ' + lancamento.descricao);
      entradaTag.required = true;
      const botaoTag = criarElemento('button', 'button secondary', 'Adicionar tag');
      botaoTag.type = 'submit';
      formularioTag.append(entradaTag, botaoTag);
      cartao.appendChild(formularioTag);
      transactionsList.appendChild(cartao);
    });
  }

  function renderizarRelatorio(lancamentos) {
    const relatorio = calcularRelatorioMensal(lancamentos, reportMonth.value);
    const moeda = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
    const [ano, mes] = reportMonth.value.split('-').map(Number);
    const periodo = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
      .format(new Date(ano, mes - 1, 1));
    const periodoFormatado = periodo.charAt(0).toUpperCase() + periodo.slice(1);
    reportPrintPeriod.textContent = 'Período: ' + periodoFormatado;
    reportPrintUser.textContent = 'Usuário: '
      + (usuarioAtual.nome || usuarioAtual.usuarios || usuarioAtual.usuario || '');
    reportTotal.textContent = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(relatorio.totalDespesas);
    reportIncome.textContent = moeda.format(relatorio.totalReceitas);
    reportNet.textContent = moeda.format(relatorio.saldoPeriodo);
    reportNet.classList.toggle('negative', relatorio.saldoPeriodo < 0);
    reportCount.textContent = relatorio.quantidadeDespesas + ' despesas · '
      + relatorio.quantidadeReceitas + ' receitas · '
      + relatorio.transacoes.length + ' lançamentos';

    reportList.replaceChildren();
    if (!relatorio.transacoes.length) {
      reportList.appendChild(criarElemento('p', 'empty report-empty', 'Nenhum lançamento registrado neste mês.'));
      return;
    }

    relatorio.transacoes.forEach(function (lancamento) {
      const linha = criarElemento('div', 'report-item');
      const informacao = document.createElement('div');
      informacao.appendChild(criarElemento('strong', '', lancamento.descricao || 'Sem descrição'));
      const data = new Date(lancamento.criado_em);
      const dataFormatada = Number.isNaN(data.getTime())
        ? 'Data indisponível'
        : new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(data);
      informacao.appendChild(criarElemento(
        'span',
        '',
        (lancamento.tipo === 'receita' ? 'Receita' : 'Despesa') + ' · ' + dataFormatada
      ));
      linha.append(informacao, criarElemento(
        'strong',
        'report-amount ' + (lancamento.tipo === 'receita' ? 'income' : 'expense'),
        (lancamento.tipo === 'receita' ? '+' : '−') + moeda.format(Number(lancamento.valor))
      ));
      reportList.appendChild(linha);
    });
  }

  async function atualizarPainel() {
    const resultado = await carregarLancamentos(usuarioAtual.id);
    if (resultado.error) throw resultado.error;
    renderizarLancamentos(resultado.data);

    const saldo = await calcularSaldo(usuarioAtual.id);
    if (saldo.error) throw saldo.error;
    balanceValue.textContent = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(saldo.data);
    renderizarRelatorio(resultado.data);
  }

  async function abrirPainel(usuario) {
    usuarioAtual = usuario;
    authView.hidden = true;
    dashboardView.hidden = false;
    welcomeTitle.textContent = 'Olá, ' + (usuario.nome || usuario.usuario) + '!';
    mostrarMensagem(transactionMessage, '');
    await atualizarPainel();
  }

  document.getElementById('login-tab').addEventListener('click', function () {
    alternarAba('login');
  });
  document.getElementById('register-tab').addEventListener('click', function () {
    alternarAba('cadastro');
  });
  reportMonth.addEventListener('change', async function () {
    try {
      const resultado = await carregarLancamentos(usuarioAtual.id);
      if (resultado.error) throw resultado.error;
      renderizarRelatorio(resultado.data);
    } catch (error) {
      mostrarMensagem(transactionMessage, error.message || 'Não foi possível carregar o relatório.');
    }
  });
  document.getElementById('print-report-button').addEventListener('click', function () {
    window.print();
  });
  loginForm.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    const dados = new FormData(loginForm);
    const botao = loginForm.querySelector('button[type="submit"]');
    botao.disabled = true;
    mostrarMensagem(authMessage, '');
    try {
      const resultado = await fazerLogin(dados.get('usuario'), dados.get('senha'));
      if (resultado.error) throw resultado.error;
      await abrirPainel(resultado.data);
    } catch (error) {
      mostrarMensagem(authMessage, error.message || 'Não foi possível entrar.');
    } finally {
      botao.disabled = false;
    }
  });

  registerForm.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    const dados = new FormData(registerForm);
    const botao = registerForm.querySelector('button[type="submit"]');
    botao.disabled = true;
    mostrarMensagem(authMessage, '');
    try {
      const resultado = await cadastrarUsuario(
        dados.get('nome'),
        dados.get('turma'),
        dados.get('usuario'),
        dados.get('senha')
      );
      if (resultado.error) throw resultado.error;
      registerForm.reset();
      await abrirPainel(resultado.data);
    } catch (error) {
      mostrarMensagem(authMessage, error.message || 'Não foi possível criar a conta.');
    } finally {
      botao.disabled = false;
    }
  });

  transactionForm.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    const dados = new FormData(transactionForm);
    const botao = transactionForm.querySelector('button[type="submit"]');
    botao.disabled = true;
    mostrarMensagem(transactionMessage, '');
    try {
      const resultado = await criarLancamento(
        usuarioAtual.id,
        dados.get('descricao'),
        dados.get('valor'),
        dados.get('tipo')
      );
      if (resultado.error) throw resultado.error;
      transactionForm.reset();
      await atualizarPainel();
      mostrarMensagem(transactionMessage, 'Lançamento salvo.', true);
    } catch (error) {
      mostrarMensagem(transactionMessage, error.message || 'Não foi possível salvar o lançamento.');
    } finally {
      botao.disabled = false;
    }
  });

  transactionsList.addEventListener('submit', async function (evento) {
    if (evento.target.matches('.edit-transaction-form')) {
      evento.preventDefault();
      const formulario = evento.target;
      const dados = new FormData(formulario);
      const botao = formulario.querySelector('button[type="submit"]');
      botao.disabled = true;
      try {
        const resultado = await editarLancamento(
          formulario.dataset.lancamentoId,
          usuarioAtual.id,
          dados.get('descricao'),
          dados.get('valor'),
          dados.get('tipo')
        );
        if (resultado.error) throw resultado.error;
        mostrarMensagem(transactionMessage, 'Lançamento atualizado.', true);
        await atualizarPainel();
      } catch (error) {
        mostrarMensagem(transactionMessage, error.message || 'Não foi possível editar o lançamento.');
      } finally {
        botao.disabled = false;
      }
      return;
    }

    if (!evento.target.matches('.tag-form')) return;
    evento.preventDefault();
    const formulario = evento.target;
    const entrada = formulario.elements.namedItem('tag');
    const botao = formulario.querySelector('button[type="submit"]');
    botao.disabled = true;
    try {
      const resultado = await adicionarTag(formulario.dataset.lancamentoId, entrada.value);
      if (resultado.error) throw resultado.error;
      await atualizarPainel();
    } catch (error) {
      mostrarMensagem(transactionMessage, error.message || 'Não foi possível adicionar a tag.');
    } finally {
      botao.disabled = false;
    }
  });

  transactionsList.addEventListener('click', function (evento) {
    const botaoExcluir = evento.target.closest('.delete-transaction-button');
    if (botaoExcluir) {
      const lancamentoId = botaoExcluir.dataset.lancamentoId;
      if (!window.confirm('Excluir este lançamento? Esta ação não pode ser desfeita.')) return;

      botaoExcluir.disabled = true;
      excluirLancamento(lancamentoId, usuarioAtual.id)
        .then(function (resultado) {
          if (resultado.error) throw resultado.error;
          mostrarMensagem(transactionMessage, 'Lançamento excluído.', true);
          return atualizarPainel();
        })
        .catch(function (error) {
          console.error('Erro ao excluir lançamento:', error);
          mostrarMensagem(transactionMessage, error.message || 'Não foi possível excluir o lançamento.');
        })
        .finally(function () {
          botaoExcluir.disabled = false;
        });
      return;
    }

    const botaoEditar = evento.target.closest('.edit-transaction-button');
    if (botaoEditar) {
      const cartao = botaoEditar.closest('.transaction');
      const formulario = cartao.querySelector('.edit-transaction-form');
      formulario.hidden = !formulario.hidden;
      botaoEditar.setAttribute('aria-expanded', String(!formulario.hidden));
      if (!formulario.hidden) formulario.elements.namedItem('descricao').focus();
      return;
    }

    const botaoCancelar = evento.target.closest('.cancel-edit-button');
    if (botaoCancelar) {
      const formulario = botaoCancelar.closest('.edit-transaction-form');
      formulario.hidden = true;
      const botaoEdicao = botaoCancelar.closest('.transaction').querySelector('.edit-transaction-button');
      botaoEdicao.setAttribute('aria-expanded', 'false');
    }
  });

  document.getElementById('logout-button').addEventListener('click', function () {
    try {
      window.localStorage.removeItem('financapp_usuario_atual');
      usuarioAtual = null;
      dashboardView.hidden = true;
      authView.hidden = false;
      loginForm.reset();
      alternarAba('login');
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
      mostrarMensagem(transactionMessage, 'Não foi possível encerrar a sessão neste navegador.');
    }
  });

  try {
    const hoje = new Date();
    reportMonth.value = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
    if (modoTesteLocal()) {
      const preparacaoDemo = garantirUsuarioDemonstracao();
      if (preparacaoDemo.error) {
        throw preparacaoDemo.error;
      }
    }
    const sessao = lerArmazenamentoLocal('financapp_usuario_atual', null);
    if (sessao.error) throw sessao.error;
    if (modoTesteLocal() && sessao.data && sessao.data.id) {
      abrirPainel(sessao.data).catch(function (error) {
        console.error('Erro ao carregar o painel:', error);
        mostrarMensagem(transactionMessage, error.message || 'Não foi possível carregar os lançamentos.');
      });
    } else if (!modoTesteLocal() && sessao.data && sessao.data._origem === 'supabase' && sessao.data.id) {
      abrirPainel(sessao.data).catch(function (error) {
        console.error('Erro ao carregar o painel:', error);
        mostrarMensagem(transactionMessage, error.message || 'Não foi possível carregar os lançamentos.');
      });
    } else if (!modoTesteLocal() && sessao.data) {
      window.localStorage.removeItem('financapp_usuario_atual');
    }
  } catch (error) {
    console.error('Erro ao recuperar sessão:', error);
    mostrarMensagem(authMessage, 'Não foi possível recuperar sua sessão.');
  }
});