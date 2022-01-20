import React, { useState, useEffect } from 'react';
import {
  RcThemeProvider,
  RcLoading,
  RcAlert,
  RcStep,
  RcStepButton,
  RcStepLabel,
  RcStepper,
} from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';

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

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 20px;
  justify-content: center;
  align-items: center;
`;

const StyledStepper = styled(RcStepper)`
  padding-bottom: 15px;
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

export function App({ integrationHelper, client }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(
    client.authorized ? 1 : 0
  );
  const [authorizationCompleted, setAuthorizationCompleted] = useState(false);
  const [formSelectionCompleted, setFormSelectionCompleted] = useState(false);

  const [authorized, setAuthorized] = useState(client.authorized);
  const [userInfo, setUserInfo] = useState({});
  const [forms, setForms] = useState([]);
  const [formInputs, setFormInputs] = useState([]);

  // Listen authorized state to load webhook data:
  useEffect(() => {
    // Listen RingCentral app submit event to submit data to server
    integrationHelper.on('submit', async (e) => {
      return {
        status: true,
      }
    });
    if (!authorized) {
      setUserInfo({});
      setForms([]);
      setFormInputs([]);
      setAuthorizationCompleted(false);
      return;
    }
    setAuthorizationCompleted(true);
    async function getInfo() {
      setLoading(true);
      try {
        const { user: userInfo } = await client.getUserInfo();
        if (userInfo) {
          setUserInfo(userInfo);
        }
        if (forms.length === 0) {
          setFormInputs([{ id: 0, value: '', error: '' }]);
        }
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
    if (forms.length === 0 && formInputs.length === 0) {
      setFormInputs([{ id: 0, value: '', error: '' }]);
    }
  }, [forms]);

  useEffect(() => {
    if (forms.length > 0 && formInputs.length === 0) {
      setFormSelectionCompleted(true);
      integrationHelper.send({ canSubmit: true });
    } else {
      setFormSelectionCompleted(false);
      integrationHelper.send({ canSubmit: false });
    }
  }, [forms, formInputs]);

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
            onDeleteForm={(formId) => setForms(forms.filter(form => form.formId !== formId))}
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
              try {
                setLoading(true);
                const newForms = await client.getForms(formInputs.map((formInput) => formInput.value));
                setForms(mergeForms(forms, newForms));
                setFormInputs([]);
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
            }}
            onLogin={() => {
              setLoading(true);
              integrationHelper.openWindow(client.authPageUri);
              async function onAuthCallback(e) {
                if (e.data && e.data.authCallback) {
                  window.removeEventListener('message', onAuthCallback);
                  if (e.data.authCallback.indexOf('error') > -1) {
                    setError('Authorization error')
                    setLoading(false);
                    return;
                  }
                  setLoading(true);
                  try {
                    // Authorize
                    await client.authorize(e.data.authCallback);
                    setAuthorized(true);
                  } catch (e) {
                    console.error(e);
                    setError('Authorization error please retry later.')
                  }
                  setLoading(false);
                }
              }
              window.addEventListener('message', onAuthCallback);
              setTimeout(() => {
                setLoading(false);
              }, 2000);
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
            }}
          />
        </Container>
      </RcLoading>
    </RcThemeProvider>
  );
}
