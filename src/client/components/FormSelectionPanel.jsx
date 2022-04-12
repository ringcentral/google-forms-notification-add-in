import React, { useState } from 'react';
import { RcButton, RcTextField, RcText, RcIcon, RcIconButton, RcTypography, RcDialog, RcDialogContent, RcDialogActions } from '@ringcentral/juno';
import { Add, Delete, InfoBorder } from '@ringcentral/juno/icon';

import { styled } from '@ringcentral/juno/foundation';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 10px;
  width: 100%;
  align-items: baseline;
`;

const SubmitButton = styled(RcButton)`
  margin-top: 20px;
`;

const AddButton = styled(RcButton)`
  margin-top: 5px;
  padding: 0;
`;

const InputLine = styled.div`
  margin-bottom: 10px;
  display: flex;
  flex-direction: row;
  width: 100%;
`;

const FormTextField = styled(RcTextField)`
  flex: 1;
`;

const Label = styled(RcText)`
  text-align: left;
  width: 100%;
  padding: 5px 0;
  font-size: 13px;
`;

const BottomButtonGroup = styled.div`
  width: 100%;
  display: flex;
  flex-direction: row;
`;

const AddFormButtonWrapper = styled.div`
  flex: 1;
`;

const FormLine = styled.div`
  margin-bottom: 5px;
  display: flex;
  flex-direction: row;
  width: 100%;
  &: hover {
    background-color: #f5f5f5;
  }
  &: last-child {
    margin-bottom: 10px;
  }
`;

const FormTitle = styled(RcText)`
  flex: 1;
  line-height: 40px;
`;

function FormLinkInput({
  value,
  onChange,
  onDelete,
  showDelete,
  error,
}) {
  return (
    <InputLine>
      <FormTextField
        variant="outline"
        placeholder="https://docs.google.com/forms/d/.../edit"
        fullWidth
        value={value}
        onChange={onChange}
        error={!!error}
        helperText={error}
      />
      {showDelete ? (<RcIconButton symbol={Delete} onClick={onDelete} />) : null}
    </InputLine>
  );
}

function FormItem({ form, onDelete }) {
  const [confirmModalOpened, setConfirmModalOpened] = useState(false);

  return (
    <FormLine>
      <FormTitle variant="body1" color="textPrimary">
        {form.info.title || form.info.documentTitle}
      </FormTitle>
      <RcIconButton
        symbol={InfoBorder}
        onClick={() => {
          window.open(`https://docs.google.com/forms/d/${form.formId}/edit`);
        }}
        title="View form"
      />
      <RcIconButton
        symbol={Delete}
        onClick={() => setConfirmModalOpened(true)}
        title="Remove this form from watch list"
      />
      <RcDialog
        open={confirmModalOpened}
        onClose={() => setConfirmModalOpened(false)}
      >
        <RcDialogContent>
          <RcTypography>Are you sure to delete this form from watch list?</RcTypography>
        </RcDialogContent>
        <RcDialogActions>
          <RcButton variant="outlined" onClick={() => setConfirmModalOpened(false)}>
            Cancel
          </RcButton>
          <RcButton onClick={() => {
            setConfirmModalOpened(false);
            onDelete();
          }}>Delete</RcButton>
        </RcDialogActions>
      </RcDialog>
    </FormLine>
  );
}

export function FormSelectionPanel({
  forms,
  onSaveFormInputs,
  onDeleteForm,
  formInputs,
  setFormInputs,
}) {
  return (
    <Container>
      {
        forms.map((form) => (
          <FormItem key={form.formId} form={form} onDelete={() => onDeleteForm(form.formId)} />
        ))
      }
      {
        formInputs.length > 0 ? (
          <Label variant="body2">
            Please input your Google Form edit URL
          </Label>
        ) : null
      }
      {
        formInputs.map((formInput) => (
          <FormLinkInput
            key={formInput.id}
            value={formInput.value}
            onChange={(event) => {
              const newFormInputs = formInputs.map((newFormInput) => {
                if (newFormInput.id === formInput.id) {
                  return { id: newFormInput.id, value: event.target.value, error: null };
                }
                return newFormInput;
              });
              setFormInputs(newFormInputs);
            }}
            showDelete={formInputs.length > 1 || forms.length > 0}
            onDelete={() => {
              const newFormInputs = formInputs.filter((newFormInput) => newFormInput.id !== formInput.id);
              setFormInputs(newFormInputs);
            }}
            error={formInput.error}
          />
        ))
      }
      <BottomButtonGroup>
        <AddFormButtonWrapper>
          <AddButton
            variant="plain"
            startIcon={<RcIcon symbol={Add} />}
            onClick={() => {
              let newId = formInputs.length > 0 ? formInputs[formInputs.length - 1].id + 1 : 0;
              setFormInputs([...formInputs, { id: newId, value: '', error: null }]);
            }}
          >
            Add additional form
          </AddButton>
        </AddFormButtonWrapper>
        {
          formInputs.length > 0 ? (
            <SubmitButton
              onClick={onSaveFormInputs}
            >
              Save
            </SubmitButton>
          ) : null
        }
      </BottomButtonGroup>
    </Container>
  );
}
