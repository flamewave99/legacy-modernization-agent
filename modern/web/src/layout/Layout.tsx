import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** Active navbar item, as each legacy JSP passes `pageName` to `layout.tag`. */
export type MenuName = 'home' | 'owners' | 'vets' | 'error';

interface MenuItemProps {
  active: boolean;
  url: string;
  title: string;
  glyph: string;
  children: ReactNode;
}

// Mirrors menuItem.tag, including its quirk of an empty class on inactive items.
function MenuItem({ active, url, title, glyph, children }: MenuItemProps) {
  return (
    <li className={active ? 'nav-item' : ''}>
      <Link className={active ? 'nav-link active' : 'nav-link'} to={url} title={title}>
        <span className={`fa ${glyph}`}></span> {children}
      </Link>
    </li>
  );
}

// Mirrors menu.tag [SPEC §2].
function Menu({ name }: { name: MenuName }) {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark" role="navigation">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">
          <span></span>
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#main-navbar"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="main-navbar">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <MenuItem active={name === 'home'} url="/" title="home page" glyph="fa-home">
              <span>Home</span>
            </MenuItem>
            <MenuItem
              active={name === 'owners'}
              url="/owners/find"
              title="find owners"
              glyph="fa-search"
            >
              <span>Find owners</span>
            </MenuItem>
            <MenuItem active={name === 'vets'} url="/vets" title="veterinarians" glyph="fa-th-list">
              <span>Veterinarians</span>
            </MenuItem>
            {/* Legacy passes the glyph without its `fa-` prefix, so no icon shows; kept for parity. */}
            <MenuItem
              active={name === 'error'}
              url="/oups"
              title="trigger a RuntimeException to see how it is handled"
              glyph="exclamation-triangle"
            >
              <span>Error</span>
            </MenuItem>
          </ul>
        </div>
      </div>
    </nav>
  );
}

// Mirrors pivotal.tag.
function Pivotal() {
  return (
    <>
      <br />
      <br />
      <div className="container">
        <div className="row">
          <div className="col-12 text-center">
            <img src="/resources/images/spring-pivotal-logo.png" alt="Sponsored by Pivotal" />
          </div>
        </div>
      </div>
    </>
  );
}

/** Page chrome from layout.tag: navbar, content container and sponsor logo. */
export function Layout({ menu, children }: { menu: MenuName; children: ReactNode }) {
  return (
    <>
      <Menu name={menu} />
      <div className="container-fluid">
        <div className="container xd-container">
          {children}
          <Pivotal />
        </div>
      </div>
    </>
  );
}
