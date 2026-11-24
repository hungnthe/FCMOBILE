import React from 'react';
import { Check, X } from 'lucide-react';

export default function OvrEditor({ value, options, images = {}, ovrPrograms = {}, ovrPositions = {}, imageOptions = [], onChange }) {
  const values = options?.length ? options : [value ?? 0];
  const selectedIndex = Math.max(0, values.findIndex((item) => String(item) === String(value)));

  const editValue = (index, nextValue) => {
    const next = [...values];
    next[index] = nextValue;
    const nextImages = { ...images };
    const nextPrograms = { ...ovrPrograms };
    const nextPositions = { ...ovrPositions };
    if (String(values[index]) !== String(nextValue)) {
      nextImages[nextValue] = images[nextValue] ?? images[values[index]] ?? '';
      if (ovrPrograms[nextValue] ?? ovrPrograms[values[index]]) nextPrograms[nextValue] = ovrPrograms[nextValue] ?? ovrPrograms[values[index]];
      if (ovrPositions[nextValue] ?? ovrPositions[values[index]]) nextPositions[nextValue] = [...(ovrPositions[nextValue] ?? ovrPositions[values[index]])];
      if (!next.some((item) => String(item) === String(values[index]))) {
        delete nextImages[values[index]];
        delete nextPrograms[values[index]];
        delete nextPositions[values[index]];
      }
    }
    onChange({ ovr: nextValue, ovr_options: next, ovr_images: nextImages, ovr_programs: nextPrograms, ovr_positions: nextPositions });
  };
  const removeValue = (index) => {
    const next = values.filter((_, itemIndex) => itemIndex !== index);
    const nextImages = { ...images };
    const nextPrograms = { ...ovrPrograms };
    const nextPositions = { ...ovrPositions };
    if (!next.some((item) => String(item) === String(values[index]))) {
      delete nextImages[values[index]];
      delete nextPrograms[values[index]];
      delete nextPositions[values[index]];
    }
    onChange({ ovr: index === selectedIndex ? next[Math.min(index, next.length - 1)] : value, ovr_options: next, ovr_images: nextImages, ovr_programs: nextPrograms, ovr_positions: nextPositions });
  };
  const selectedImage = images[value] || '';
  const availableImages = [...new Set([...imageOptions, ...Object.values(images).filter(Boolean)])];
  const imageUrl = selectedImage.startsWith('public/') ? `/${selectedImage.slice(7)}` : selectedImage;
  const addValue = () => {
    const nextValue = Math.max(...values.map((item) => Number(item) || 0)) + 1;
    onChange({ ovr: nextValue, ovr_options: [...values, nextValue] });
  };

  return <fieldset className="ovr-editor">
    <legend>Chỉ số OVR</legend>
    <div className="ovr-options">
      {values.map((item, index) => <div className={`ovr-option ${index === selectedIndex ? 'is-selected' : ''}`} key={index}>
        <button type="button" className="ovr-select" aria-label={`Dùng OVR ${item}`} aria-pressed={index === selectedIndex} onClick={() => onChange({ ovr: item, ovr_options: values })}>{index === selectedIndex && <Check />}</button>
        <input required type="number" min="0" step="1" aria-label={`Mức OVR ${index + 1}`} value={item} onChange={(event) => editValue(index, event.target.value)} />
        {values.length > 1 && <button type="button" className="ovr-remove" aria-label={`Xóa mức OVR ${index + 1}`} onClick={() => removeValue(index)}><X /></button>}
      </div>)}
      <button type="button" className="position-add-button" onClick={addValue}>+ Thêm OVR</button>
    </div>
    <small>Chọn dấu tròn để dùng OVR tương ứng.</small>
    <div className="ovr-image-picker">
      {imageUrl && <img src={imageUrl} alt={`Ảnh thẻ OVR ${value}`} />}
      <label>Ảnh thẻ OVR {value}<select aria-label={`Ảnh thẻ OVR ${value}`} value={selectedImage} onChange={(event) => onChange({ ovr_images: { ...images, [value]: event.target.value } })}>
        <option value="">Chọn ảnh cho OVR này</option>
        {availableImages.map((source) => <option key={source} value={source}>{source.split('/').pop()}</option>)}
      </select></label>
    </div>
  </fieldset>;
}
