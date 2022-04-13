import React, { useState, useEffect, useCallback } from 'react';
import {
  RcThemeProvider,
  RcIconButton,
  RcLoading,
  RcAlert,
  RcStep,
  RcStepButton,
  RcStepLabel,
  RcStepper,
} from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';
import Feedback from '@ringcentral/juno/icon/Feedback';

import { AuthorizationPanel } from './AuthorizationPanel';
import { FormSelectionPanel } from './FormSelectionPanel';

const GOOGLE_FORM_LINK_REGEXP = /^https:\/\/docs.google.com\/forms\/d\/[a-zA-Z0-9_.-]+\/edit/

function mergeForms(oldForms, newForms) {
  const forms = [];
  const formsMap = {};
  oldForms.forEach(form => {
    formsMap[form.formId] = 1;
    forms.push(form);
  });
  newForms.forEach(form => {
    if (!formsMap[form.formId]) {
      forms.push(form);
      formsMap[form.formId] = 1;
    }
  });
  return forms;
}

function getFormIdFromLink(formLink) {
  const formUrl = formLink.split('?')[0].replace('/edit', '');
  return formUrl.split('/').pop();
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 35px;
  justify-content: center;
  align-items: center;
`;

const StyledStepper = styled(RcStepper)`
  padding-bottom: 15px;
`;

const FloatingLink = styled.a`
  position: fixed;
  left: 5px;
  bottom: 10px;
`;

function StepContent({
  activeStep,
  setActiveStep,
  userInfo,
  authorized,
  onLogin,
  onLogout,
  forms,
  onSaveFormInputs,
  onDeleteForm,
  formInputs,
  setFormInputs
}) {
  if (activeStep === 1) {
    return (
      <FormSelectionPanel
        forms={forms}
        onDeleteForm={onDeleteForm}
        onSaveFormInputs={onSaveFormInputs}
        formInputs={formInputs}
        setFormInputs={setFormInputs}
        gotoNextStep={() => setActiveStep(2)}
      />
    );
  }
  return (
    <AuthorizationPanel
      authorized={authorized}
      userInfo={userInfo}
      gotoNextStep={() => setActiveStep(1)}
      onLogin={onLogin}
      onLogout={onLogout}
    />
  );
}

export function App({ integrationHelper, client, analytics }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [authorizationCompleted, setAuthorizationCompleted] = useState(false);
  const [formSelectionCompleted, setFormSelectionCompleted] = useState(false);

  const [authorized, setAuthorized] = useState(client.authorized);
  const [userInfo, setUserInfo] = useState({});
  const [forms, setForms] = useState([]);
  const [formInputs, setFormInputs] = useState([]);
  const [subscribedFormIds, setSubscribedFormIds] = useState([]);

  // Listen authorized state to load webhook data:
  useEffect(() => {
    if (!authorized) {
      setUserInfo({});
      setForms([]);
      setFormInputs([]);
      setAuthorizationCompleted(false);
      setFormSelectionCompleted(false);
      setActiveStep(0);
      return;
    }
    setAuthorizationCompleted(true);
    async function getInfo() {
      setLoading(true);
      try {
        const { user: userInfo, formIds } = await client.getUserInfo();
        if (userInfo) {
          setUserInfo(userInfo);
        }
        if (formIds && formIds.length > 0) {
          setSubscribedFormIds(formIds);
          const newForms = await client.getForms(formIds);
          setForms(newForms);
        }
        if (!formIds || formIds.length === 0) {
          setFormInputs([{ id: 0, value: '', error: '' }]);
        } else {
          setFormInputs([]);
        }
        setActiveStep(1);
      } catch (e) {
        console.error(e);
        if (e.message === 'Unauthorized') {
          setError('Authorization required.');
          setAuthorized(false);
        } else {
          setError('Fetch data error please retry later');
        }
      }
      setLoading(false);
    }
    getInfo();
  }, [authorized]);

  useEffect(() => {
    // Listen RingCentral app submit event to submit data to server
    integrationHelper.on('submit', async () => {
      setLoading(true);
      analytics.track('Subscribe Google form');
      const formIds = forms.map(form => form.formId);
      try {
        await client.subscribe(formIds);
        setSubscribedFormIds(formIds);
        setLoading(false);
        return {
          status: true,
        };
      } catch (e) {
        console.error(e);
        setLoading(false);
        return {
          status: false,
        };
      }
    });
    return () => {
      integrationHelper.dispose();
    };
  }, [forms]);

  useEffect(() => {
    if (forms.length === 0 && formInputs.length === 0) {
      setFormInputs([{ id: 0, value: '', error: '' }]);
    }
  }, [authorized, forms]);

  useEffect(() => {
    if (forms.length > 0 && formInputs.length === 0) {
      setFormSelectionCompleted(true);
      integrationHelper.send({ canSubmit: true });
    } else {
      setFormSelectionCompleted(false);
      integrationHelper.send({ canSubmit: false });
    }
  }, [forms, formInputs]);

  const onAuthCallback = useCallback(async (e) => {
    if (e.data && e.data.authCallback) {
      window.removeEventListener('message', onAuthCallback);
      if (e.data.authCallback.indexOf('error') > -1) {
        setError('Authorization error')
        setLoading(false);
        analytics.track('Authorize Google error');
        return;
      }
      if (
        e.data.authCallback.indexOf('forms.responses.readonly') === -1 ||
        e.data.authCallback.indexOf('forms.body.readonly') === -1
      ) {
        setError('Please allow read-only access to forms and responses');
        setLoading(false);
        analytics.track('Authorize Google scope error');
        return;
      }
      setLoading(true);
      try {
        // Authorize
        await client.authorize(e.data.authCallback);
        setAuthorized(true);
        analytics.track('Authorize Google success');
      } catch (e) {
        console.error(e);
        setError('Authorization error please retry later.')
      }
      setLoading(false);
    }
  }, []);

  return (
    <RcThemeProvider>
      <RcLoading loading={loading}>
        {
          (error && error.length > 0) ? (
            <RcAlert severity="warning" onClose={() => setError('')}>
              {error}
            </RcAlert>
          ) : null
        }
        <StyledStepper activeStep={activeStep}>
          <RcStep completed={authorizationCompleted}>
            {
              authorizationCompleted ? (
                <RcStepButton onClick={() => setActiveStep(0)}>
                  Authorization
                </RcStepButton>
              ) : (
                <RcStepLabel>
                  Authorization
                </RcStepLabel>
              )
            }
          </RcStep>
          <RcStep completed={formSelectionCompleted}>
            {
              formSelectionCompleted ? (
                <RcStepButton onClick={() => setActiveStep(1)}>
                  Set Forms
                </RcStepButton>
              ) : (
                <RcStepLabel>
                  Set Forms
                </RcStepLabel>
              )
            }
          </RcStep>
        </StyledStepper>
        <Container>
          <StepContent
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            authorized={authorized}
            userInfo={userInfo}
            forms={forms}
            onDeleteForm={async (formId) => {
              setLoading(true);
              try {
                if (subscribedFormIds.indexOf(formId) !== -1) {
                  await client.deleteSubscription(formId);
                }
                setLoading(false);
              } catch (e) {
                if (e.message === 'Unauthorized') {
                  setError('Authorization required.');
                  setAuthorized(false);
                } else {
                  setError('Delete form error please retry later');
                }
                setLoading(false);
                return;
              }
              setForms(forms.filter(form => form.formId !== formId));
              analytics.track('Delete Google form');
            }}
            formInputs={formInputs}
            setFormInputs={setFormInputs}
            onSaveFormInputs={async () => {
              const validatedFormInput = formInputs.map((formInput) => {
                const validated = GOOGLE_FORM_LINK_REGEXP.test(formInput.value);
                if (!validated) {
                  return { ...formInput, error: 'Please input a valid Google Form edit URL' };
                }
                return formInput;
              });
              const formInputsWithError = validatedFormInput.filter((formInput) => !!formInput.error);
              if (formInputsWithError.length > 0) {
                setFormInputs(validatedFormInput);
                return;
              }
              if (formInputs.length + forms.length > 10) {
                setError('Maximum 10 forms allowed.');
                return;
              }
              try {
                setLoading(true);
                const newForms = await client.getForms(formInputs.map((formInput) => getFormIdFromLink(formInput.value)));
                const noErrorForms = newForms.filter(form => !form.error);
                const hasErrorForms = newForms.filter(form => !!form.error);
                setForms(mergeForms(forms, noErrorForms));
                if (hasErrorForms.length > 0) {
                  setError('The add-in only support to connect a Google form for a team. Please remove the form at your previous connections.');
                }
                setFormInputs(formInputs.filter((formInput) => {
                  let error = false;
                  hasErrorForms.forEach((errorForm) => {
                    if (formInput.value.indexOf(errorForm.formId) > -1) {
                      error = true;
                    }
                  });
                  return !!error;
                }));
                setLoading(false);
              } catch (e) {
                console.error(e);
                setLoading(false);
                if (e.message === 'Unauthorized') {
                  setError('Authorization required.');
                  setAuthorized(false);
                } else {
                  setError('Fetch data error please retry later');
                }
              }
              analytics.track('Save Google form');
            }}
            onLogin={() => {
              setLoading(true);
              integrationHelper.openWindow(client.authPageUri);
              window.removeEventListener('message', onAuthCallback);
              window.addEventListener('message', onAuthCallback);
              setTimeout(() => {
                setLoading(false);
              }, 2000);
              analytics.track('Authorize Google');
            }}
            onLogout={async () => {
              setLoading(true);
              try {
                // Logout and Unsubscribe
                await client.logout();
                setLoading(false);
                setAuthorized(false);
              } catch (e) {
                console.error(e);
                setLoading(false);
                setError('Logout error please retry later.');
              }
              analytics.track('Unauthorize Google');
            }}
          />
        </Container>
        <FloatingLink
          href="https://forms.gle/ZKj8cHCxAfj4FXQh7"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            analytics.track('Click feedback button');
          }}
        >
          <RcIconButton
            symbol={Feedback}
            variant="contained"
            color="action.primary"
            title="Feedback (Any suggestions, or issues about this add-in?)"
          />
        </FloatingLink>
      </RcLoading>
    </RcThemeProvider>
  );
}
