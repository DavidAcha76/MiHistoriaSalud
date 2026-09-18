import type React from 'react';

type TimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export declare function TimeField(props: TimeFieldProps): React.ReactElement;
