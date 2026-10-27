export const metadata = { title: "Privacidade — Assistente Virtual LPCC" };

export default function Privacy() {
  return (
    <main className="page">
      <h1>Aviso de privacidade do Assistente Virtual</h1>
      <p>
        O Assistente Virtual da Liga Portuguesa Contra o Cancro responde a perguntas com base em
        documentos aprovados pela LPCC.
      </p>
      <h2>Que dados são tratados</h2>
      <ul>
        <li>O texto das suas perguntas e, se usar o microfone, a gravação da sua voz.</li>
        <li>
          Estes dados são enviados para o serviço Google Gemini apenas para gerar a resposta ou
          transcrever a voz.
        </li>
      </ul>
      <h2>O que não fazemos</h2>
      <ul>
        <li>Não guardamos as conversas nem as gravações de voz.</li>
        <li>Não pedimos nome, contactos ou dados de saúde, pelo chat.</li>
        <li>A conversa desaparece quando fecha ou atualiza a página.</li>
      </ul>
      <h2>Recomendação</h2>
      <p>
        Por favor, não partilhe dados pessoais ou informação sobre a sua saúde. Para
        acompanhamento personalizado, contacte diretamente a LPCC.
      </p>
      <h2>Contactos</h2>
      <h3>Geral</h3>
      <p>
        <a href="tel:808255255">808 255 255</a> | <a href="tel:217221810">21 722 1810</a>
        <br />
        <a href="mailto:info@ligacontracancro.pt">info@ligacontracancro.pt</a>
      </p>
      <h3>Núcleo Regional do Sul</h3>
      <p>
        <a href="tel:217264099">217 264 099</a> | <a href="tel:217271241">217 271 241</a>
        <br />
        <a href="mailto:nucleosul@ligacontracancro.pt">nucleosul@ligacontracancro.pt</a>
      </p>
      <p>
        <a href="/">Voltar ao assistente</a>
      </p>
    </main>
  );
}
