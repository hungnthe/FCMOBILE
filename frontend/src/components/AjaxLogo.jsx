import React from 'react';
import ajaxLogo from '../../Logo_AFC_Ajax_(1928-1991,_2025-).png';

export default function AjaxLogo({ size = 120, className = '' }) {
  return (
    <img
      className={className}
      width={size}
      height={size}
      src={ajaxLogo}
      alt="Ajax Amsterdam crest"
      role="img"
    />
  );
}
