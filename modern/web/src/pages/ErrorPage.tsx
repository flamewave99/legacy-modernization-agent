import { Layout } from '../layout/Layout.js';

// exception.jsp [SPEC §4.8]. Legacy renders it with HTTP 200 and the `error` menu item active,
// whichever page raised the exception.
export function ErrorPage({ message }: { message: string }) {
  return (
    <Layout menu="error">
      <img src="/resources/images/pets.png" alt="A cat and a dog" />
      <h2>Something happened...</h2>
      <p>{message}</p>
    </Layout>
  );
}
