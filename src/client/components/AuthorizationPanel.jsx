import React, { Fragment, useState } from 'react';
import { RcButton, RcText, RcTypography, RcDialog, RcDialogContent, RcDialogActions, RcIcon } from '@ringcentral/juno';
import { styled } from '@ringcentral/juno/foundation';
import GoogleLogo from '@ringcentral/juno/icon/GoogleLogo';

const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: row;
`;

const LoginInfo = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: row;
  padding: 20px 0;
`;

const LoginTitle = styled(RcTypography)`
  margin-top: 10px;
`;

const GoogleSignButton = styled(RcButton)`
  height: 40px;
  box-shadow: rgb(0 0 0 / 20%) 0px 1px 8px 0px, rgb(0 0 0 / 14%) 0px 3px 4px 0px, rgb(0 0 0 / 12%) 0px 3px 3px -2px;
  font-weight: 500;
  font-size: 14px;
  font-family: Roboto,Lato,Helvetica,Arial,sans-serif;
  padding: 0 12px;

  svg {
    margin-right: 9px;
    width: 24px;
    height: 24px;
  }

  .MuiButton-label {
    color: rgba(0, 0, 0, 0.54);
  }
`;

function LoginPanel({
  onLogin,
}) {
  const content = window.clientConfig.isBeta ? (
    <RcTypography color="secondary" display="block">
      Warning: This service is at beta stage. Please click "Advanced" when seeing a "Google hasn't verified this app" page at Google Authorization. Then select "See all responses" and "See all Forms" for access.
    </RcTypography>
  ) : (
    <LoginTitle
      color="textPrimary"
      variant="subheading1"
      paragraph
      display="block"
    >
      To begin, please connect your Google account.
    </LoginTitle>
  );
  return (
    <Fragment>
      {content}
      <br />
      <GoogleSignButton
        onClick={onLogin}
        startIcon={<RcIcon symbol={GoogleLogo} />}
        variant="text"
        color="action.grayDark"
      >
        Sign in with Google
      </GoogleSignButton>
    </Fragment>
  )
}

function UserCenter({
  userInfo,
  onLogout,
  gotoNextStep,
}) {
  const [confirmModalOpened, setConfirmModalOpened] = useState(false);
  return (
    <Fragment>
      <LoginInfo>
        <RcText variant="subheading1" color="textPrimary">
          Authenticated as &nbsp;
        </RcText>
        <RcText variant="subheading2">
          {userInfo.name}
        </RcText>
      </LoginInfo>
      <ButtonGroup>
        <RcButton
          variant="outlined"
          onClick={() => setConfirmModalOpened(true)}
        >
          Logout
        </RcButton>
        &nbsp;
        &nbsp;
        <RcButton onClick={() => gotoNextStep()}>
          Next Step
        </RcButton>
      </ButtonGroup>
      <RcDialog
        open={confirmModalOpened}
        onClose={() => setConfirmModalOpened(false)}
      >
        <RcDialogContent>
          <RcTypography>Are you sure to unauthorize? All notifications subscribed with this account will be stopped.</RcTypography>
        </RcDialogContent>
        <RcDialogActions>
          <RcButton variant="outlined" onClick={() => setConfirmModalOpened(false)}>
            Cancel
          </RcButton>
          <RcButton onClick={() => {
            setConfirmModalOpened(false);
            onLogout();
          }}>Confirm</RcButton>
        </RcDialogActions>
      </RcDialog>
    </Fragment>
  );
}

export function AuthorizationPanel({
  authorized,
  onLogin,
  userInfo,
  onLogout,
  gotoNextStep,
}) {
  if (authorized) {
    return (
      <UserCenter
        userInfo={userInfo}
        onLogout={onLogout}
        gotoNextStep={gotoNextStep}
      />
    );
  }

  return (
    <LoginPanel
      onLogin={onLogin}
    />
  );
}
