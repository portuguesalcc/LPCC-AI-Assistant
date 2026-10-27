export const metadata = { title: "Privacidade — Assistente Virtual LPCC" };

export default function Privacy() {
  return (
    <main className="page">
      <p className="draft">
        <strong>Rascunho:</strong> este texto tem de ser revisto e aprovado pela LPCC e pelo seu
        Encarregado de Proteção de Dados antes da publicação.
      </p>
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
        <li>Não pedimos nome, contactos ou dados de saúde.</li>
        <li>A conversa desaparece quando fecha ou atualiza a página.</li>
      </ul>
      <h2>Recomendação</h2>
      <p>
        Por favor, não partilhe dados pessoais ou informação sobre a sua saúde. Para
        acompanhamento personalizado, contacte diretamente a LPCC.
      </p>
      <h2>Contactos</h2>
      <p>[A preencher pela LPCC: contacto do responsável pelo tratamento e do EPD.]</p>
      <p>
        <a href="/">Voltar ao assistente</a>
      </p>
    </main>
  );
}
