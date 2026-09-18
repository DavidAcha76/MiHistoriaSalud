import type React from 'react';

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimumDate?: string;
  maximumDate?: string;
  clearable?: boolean;
  disabled?: boolean;
};

export declare function DateField(props: DateFieldProps): React.ReactElement;
