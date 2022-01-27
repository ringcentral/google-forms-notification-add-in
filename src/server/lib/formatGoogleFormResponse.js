function getAnswers(form, response) {
  const answers = [];
  form.items.forEach((item) => {
    if (!item.questionItem) {
      return;
    }
    const question = item.questionItem.question;
    const answer =
      response.answers[question.questionId] &&
      response.answers[question.questionId].textAnswers &&
      response.answers[question.questionId].textAnswers.answers.map(value => value.value).join(', ');
    if (answer) {
      answers.push({
        question: item.title,
        answer,
      });
    }
  });
  return answers;
}

function formatGoogleFormResponse(form, response) {
  const formUrl = `https://docs.google.com/forms/d/${form.formId}/edit`;
  return {
    formId: form.formId,
    formTitle: form.info.title,
    formUrl,
    responseId: response.id,
    responseUrl: `${formUrl}#response=${response.responseId}`,
    answers: getAnswers(form, response),
  }
}

exports.formatGoogleFormResponse = formatGoogleFormResponse;
