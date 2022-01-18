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
}) {
  if (activeStep === 1) {
    return (
      <FormSelectionPanel
        forms={forms}
        onDeleteForm={onDeleteForm}
        onSaveFormInputs={onSaveFormInputs}
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
  const [subscribed, setSubscribed] = useState(false);
  const [forms, setForms] = useState([]);

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
  }, [authorized, subscribed]);

  useEffect(() => {
    if (forms.length > 0) {
      setFormSelectionCompleted(true);
    } else {
      setFormSelectionCompleted(false);
    }
  }, [forms]);

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
        <RcStepper activeStep={activeStep}>
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
        </RcStepper>
        <Container>
          <StepContent
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            authorized={authorized}
            userInfo={userInfo}
            forms={forms}
            onDeleteForm={(formId) => setForms(forms.filter(form => form.formId !== formId))}
            onSaveFormInputs={async (formInputs) => {
              try {
                setLoading(true);
                const newForms = await client.getForms(formInputs);
                setForms(mergeForms(forms, newForms));
                setLoading(false);
                return true;
              } catch (e) {
                console.error(e);
                setLoading(false);
                if (e.message === 'Unauthorized') {
                  setError('Authorization required.');
                  setAuthorized(false);
                } else {
                  setError('Fetch data error please retry later');
                }
                return false;
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
