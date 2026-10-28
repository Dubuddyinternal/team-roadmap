export default function Icon({ name, className = '', style }) {
  return (
    <svg className={`ico ${className}`.trim()} viewBox="0 0 100 100" style={style}>
      <use href={`#${name}`} />
    </svg>
  );
}
