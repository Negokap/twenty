import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';
import { t } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/primitives/input';

// Shows on Company and Opportunity records that have a `setjooProjectUrl` custom field
// (a Links or Text field added in Settings > Data model).
const SETJOO_PROJECT_URL_FIELD_NAME = 'setjooProjectUrl';
const SUPPORTED_OBJECT_NAMES = ['company', 'opportunity'];

type SetjooProjectLinkProps = {
  objectNameSingular: string;
  objectRecordId: string;
};

export const SetjooProjectLink = ({
  objectNameSingular,
  objectRecordId,
}: SetjooProjectLinkProps) => {
  const record = useAtomFamilyStateValue(
    recordStoreFamilyState,
    objectRecordId,
  );

  if (!SUPPORTED_OBJECT_NAMES.includes(objectNameSingular)) {
    return null;
  }

  const fieldValue = record?.[SETJOO_PROJECT_URL_FIELD_NAME];
  const rawUrl: unknown = isDefined(fieldValue?.primaryLinkUrl)
    ? fieldValue.primaryLinkUrl
    : fieldValue;

  if (!isNonEmptyString(rawUrl)) {
    return null;
  }

  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  return (
    <Button
      size="sm"
      href={url}
      target="_blank"
      rel="noreferrer"
    >{t`Open in Setjoo Projects`}</Button>
  );
};
