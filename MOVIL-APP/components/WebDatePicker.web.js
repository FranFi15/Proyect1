import React, { useEffect } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import es from 'date-fns/locale/es';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('es', es);

const STYLE_ID = 'gw-web-datepicker-z-style';

const ensurePopperStyles = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  // Keep calendar above RN Modal / action buttons (same picker as turnos).
  style.textContent = `
    .react-datepicker-popper {
      z-index: 100000 !important;
    }
    .react-datepicker-wrapper,
    .react-datepicker__input-container {
      width: 100%;
      display: block;
    }
  `;
  document.head.appendChild(style);
};

const WebDatePicker = (props) => {
  useEffect(() => {
    ensurePopperStyles();
  }, []);

  return (
    <DatePicker
      locale="es"
      dateFormat="dd/MM/yyyy"
      popperPlacement="bottom-start"
      popperProps={{ strategy: 'fixed' }}
      {...props}
    />
  );
};

export default WebDatePicker;
