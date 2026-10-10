/** Every page starts with a red banner holding the title, a short description and optional actions. */
export function PageBanner({ title, description, actions }) {
  return (
    <header className="banner">
      <div className="stack-sm">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}
