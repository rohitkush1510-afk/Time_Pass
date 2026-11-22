import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api';
import { toEndOfDayISO } from '../utils/dates';
import { fileToImageDataUrl } from '../utils/images';

export default function CreateCampaign() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState('Medical');
  const [imageUrl, setImageUrl] = useState('');
  const [imageData, setImageData] = useState('');
  const [imageName, setImageName] = useState('');
  const [imageBroken, setImageBroken] = useState(false);
  const [error, setError] = useState('');

  const previewSrc = imageData || imageUrl.trim();

  async function loadImageFile(file) {
    if (!file) return;
    setError('');
    setImageBroken(false);
    try {
      const dataUrl = await fileToImageDataUrl(file);
      setImageData(dataUrl);
      setImageName(file.name || 'pasted image');
      setImageUrl('');
    } catch (err) {
      setError(err.message);
    }
  }


  function handlePaste(e) {
    const items = e.clipboardData ? Array.from(e.clipboardData.items) : [];
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return; // normal text paste keeps working
    e.preventDefault();
    loadImageFile(imageItem.getAsFile());
  }

  function clearImage() {
    setImageUrl('');
    setImageData('');
    setImageName('');
    setImageBroken(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await request('/campaigns', 'POST', {
        title,
        description,
        goal,
        deadline: toEndOfDayISO(deadline),
        category,
        imageUrl: imageData ? '' : imageUrl,
        imageData
      });
      alert('Campaign created! It will be visible after admin approval.');
      navigate('/my-campaigns');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h2>Create a Campaign</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />

        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />

        <label>Goal amount</label>
        <input type="number" min="1" value={goal} onChange={(e) => setGoal(e.target.value)} />

        <label>Deadline</label>
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />

        <label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>Medical</option>
          <option>Education</option>
          <option>Tech</option>
          <option>Animals</option>
          <option>Other</option>
        </select>

        <label>Picture (optional)</label>
        <p className="small">
          Paste a picture with Ctrl+V in the box below, upload a file, or paste an image URL.
        </p>
        <input
          value={imageUrl}
          onChange={(e) => {
            setImageUrl(e.target.value);
            setImageData('');
            setImageName('');
            setImageBroken(false);
          }}
          onPaste={handlePaste}
          placeholder="https://example.com/picture.jpg — or Ctrl+V an image"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) loadImageFile(e.target.files[0]);
            e.target.value = ''; 
          }}
        />

        {imageData && (
          <p className="small">
            Picture ready: <b>{imageName}</b>{' '}
            <button type="button" onClick={clearImage}>Remove picture</button>
          </p>
        )}

        {previewSrc && (
          <div className="image-preview">
            {imageBroken ? (
              <p className="error small">Could not load this image. Check the URL.</p>
            ) : (
              <img
                src={previewSrc}
                alt="Campaign preview"
                onError={() => setImageBroken(true)}
              />
            )}
          </div>
        )}

        <button type="submit">Create</button>
      </form>
    </div>
  );
}
