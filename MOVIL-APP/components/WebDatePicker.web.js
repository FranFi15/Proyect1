import React, { useEffect } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import es from 'date-fns/locale/es';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('es', es);

const STYLE_ID = 'gw-web-datepicker-z-style';
const PORTAL_ID = 'gw-datepicker-portal';

const ensurePopperStyles = () => {
  if (typeof document === 'undefined') return;
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    // Portal + high z-index keeps calendar above ScrollViews / RN stacking contexts (Caja, turnos, etc.).
    style.textContent = `
      #${PORTAL_ID} {
        position: relative;
        z-index: 100000;
      }
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
  }
  if (!document.getElementById(PORTAL_ID)) {
    const portal = document.createElement('div');
    portal.id = PORTAL_ID;
    document.body.appendChild(portal);
  }
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
      portalId={PORTAL_ID}
      {...props}
    />
  );
};

export default WebDatePicker;
