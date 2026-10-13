import { Layout } from '../layout/Layout.js';

// welcome.jsp [SPEC §3].
export function Welcome() {
  return (
    <Layout menu="home">
      <h2>Welcome</h2>
      <div className="row">
        <div className="col-md-12">
          <img className="img-responsive" alt="A cat and a dog" src="/resources/images/pets.png" />
        </div>
      </div>
    </Layout>
  );
}
