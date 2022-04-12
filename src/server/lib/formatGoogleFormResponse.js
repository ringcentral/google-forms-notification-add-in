const { Template } = require('adaptivecards-templating');
const responseTemplate = require('../adaptiveCardPayloads/response.json');
const { findItemInAdaptiveCard } = require('./findItemInAdaptiveCard');

function getAnswerFromResponse(response, questionId) {
  return response.answers[questionId] &&
    response.answers[questionId].textAnswers &&
    response.answers[questionId].textAnswers.answers.map(value => value.value).join(', ');
}

function getAnswers(form, response) {
  const answers = [];
  form.items.forEach((item) => {
    if (item.questionItem) {
      const question = item.questionItem.question;
      const answer = getAnswerFromResponse(response, question.questionId);
      if (answer) {
        let answerDescription = '';
        if (question.scaleQuestion) {
          answerDescription = `"${question.scaleQuestion.low} = ${question.scaleQuestion.lowLabel}  ${question.scaleQuestion.high} = ${question.scaleQuestion.highLabel}": `;
        }
        answers.push({
          type: 'Container',
          items: [
            {
              type: 'TextBlock',
              text: item.title,
              wrap: true,
              weight: 'Bolder',
            },
            {
              type: 'TextBlock',
              wrap: true,
              text: `${answerDescription}${answer}`,
            },
          ]
        });
      }
    }
    if (item.questionGroupItem && item.questionGroupItem.questions) {
      const columns = [];
      item.questionGroupItem.questions.forEach((question) => {
        const answer = getAnswerFromResponse(response, question.questionId);
        if (answer) {
          columns.push({
            type: 'ColumnSet',
            columns: [
              {
                type: 'Column',
                items: [
                  {
                    type: 'TextBlock',
                    text: `${question.rowQuestion.title}:`
                  }
                ],
                width: 'stretch',
              },
              {
                type: 'Column',
                items: [
                  {
                    type: 'TextBlock',
                    text: answer,
                    wrap: true,
                    weight: 'Bolder'
                  }
                ],
                width: 'stretch',
              },
            ],
          });
        }
      });
      if (columns.length > 0) {
        const container = {
          type: 'Container',
          items: [
            {
              type: 'TextBlock',
              text: item.title,
              wrap: true,
              weight: 'Bolder',
            },
          ],
        };
        if (item.description) {
          container.items.push({
            type: 'TextBlock',
            text: item.description,
            wrap: true,
            size: 'Small',
            isSubtle: true,
          });
        }
        container.items = container.items.concat(columns);
        answers.push(container);
      }
    }
  });
  return answers;
}

function formatGoogleFormResponseIntoCard(form, response) {
  const formUrl = `https://docs.google.com/forms/d/${form.formId}/edit`;
  const allAnswers = getAnswers(form, response);
  const answers = allAnswers.slice(0, 5);
  const moreAnswers = allAnswers.length > 5 ? allAnswers.slice(5) : [];
  const template = new Template(responseTemplate);
  const card = template.expand({
    $root: {
      formId: form.formId,
      formTitle: form.info.title || form.info.documentTitle,
      formUrl,
      responseId: response.id,
      responseUrl: `${formUrl}#response=${response.responseId}`,
    },
  });
  const answersItem = findItemInAdaptiveCard(card, 'answers');
  answersItem.items = answers;
  if (moreAnswers.length > 0) {
    const moreAnswersItem = findItemInAdaptiveCard(card, 'moreAnswers');
    const moreAnswerButton = findItemInAdaptiveCard(card, 'shoreMoreButtons');
    moreAnswersItem.items = moreAnswers;
    delete moreAnswerButton.isVisible;
  }
  return card;
}

exports.formatGoogleFormResponseIntoCard = formatGoogleFormResponseIntoCard;
