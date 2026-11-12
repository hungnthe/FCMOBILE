import React from 'react';
import { X } from 'lucide-react';

export default function PositionEditor({ ovr, positions = [], onChange }) {
  const values = positions.length ? positions : [''];
  const editValue = (index, value) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };
  return <fieldset className="position-field">
    <legend>Position</legend>
    <div className="position-editor">
      {values.map((value, index) => <div className="position-entry" key={index}>
        <input required={index === 0} className="position-square" maxLength="5" aria-label={`Vị trí ${index + 1} của OVR ${ovr}`} value={value} onChange={(event) => editValue(index, event.target.value)} />
        {values.length > 1 && <button type="button" className="ovr-remove" aria-label={`Xóa vị trí ${index + 1} của OVR ${ovr}`} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}><X /></button>}
      </div>)}
      <button type="button" className="position-add-button" onClick={() => onChange([...values, ''])}>+ Add</button>
    </div>
  </fieldset>;
}
