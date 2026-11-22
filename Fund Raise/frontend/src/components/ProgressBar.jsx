export default function ProgressBar({ raised, goal }) {
  let percent = 0;
  if (goal > 0) percent = (raised / goal) * 100;
  if (percent > 100) percent = 100;

  return (
    <div>
      <div className="bar-bg">
        <div className="bar-fill" style={{ width: percent + '%' }}></div>
      </div>
      <p className="small">
        {raised} raised of {goal} ({percent.toFixed(1)}%)
      </p>
    </div>
  );
}