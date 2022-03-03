const { Template } = require('adaptivecards-templating');
const responseTemplate = require('../adaptiveCardPayloads/response.json');
const { findItemInAdaptiveCard } = require('./findItemInAdaptiveCard');

function getAnswers(form, response) {
  const answers = [];
  form.items.forEach((item) => {
    if (item.questionItem) {
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
    }
    if (item.questionGroupItem) {
      
    }
  });
  return answers;
}

function formatGoogleFormResponseIntoCard(form, response) {
  const formUrl = `https://docs.google.com/forms/d/${form.formId}/edit`;
  const answers = getAnswers(form, response);
  const params = {
    formId: form.formId,
    formTitle: form.info.title,
    formUrl,
    responseId: response.id,
    responseUrl: `${formUrl}#response=${response.responseId}`,
    answers: answers.slice(0, 5),
    moreAnswers: answers.length > 5 ? answers.slice(5) : [],
  }
  const template = new Template(responseTemplate);
  const card = template.expand({
    $root: params
  });
  if (params.moreAnswers.length > 0) {
    const moreAnswerButton = findItemInAdaptiveCard(card, 'shoreMoreButtons');
    delete moreAnswerButton.isVisible;
  }
  return card;
}

exports.formatGoogleFormResponseIntoCard = formatGoogleFormResponseIntoCard;
