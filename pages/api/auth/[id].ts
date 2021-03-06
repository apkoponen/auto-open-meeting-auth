import gql from "graphql-tag";
import { Auth, getAwsClient } from "../../../src/api/aws";
import { route } from "../../../src/api/helpers";
import qs from "qs";
import Axios from "axios";

const query = gql(`
query getAuth($id: ID!) {
  getAuth(id: $id) {
    id
    code
  }
}
`);

const deleteMutation = gql(`
mutation deleteAuth($input: DeleteAuthInput!) {
  deleteAuth(input: $input) {
    id
  }
}
`);

export default route().get(async (req, res) => {
  const { id } = req.query;

  if (!id) {
    res.status(400).end();
  }

  const client = getAwsClient();
  await client.hydrated();
  const { data } = await client.query<{ getAuth: Auth }>({
    query,
    variables: {
      id,
    },
  });

  if (!data.getAuth || !data.getAuth.id) {
    return res.status(404).end();
  }

  if (!data.getAuth.code) {
    return res.status(204).end();
  }

  try {
    const response = await Axios.post(
      "https://oauth2.googleapis.com/token",
      qs.stringify({
        code: data.getAuth.code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    res.status(200).json(response.data);
    await client.mutate({
      mutation: deleteMutation,
      variables: {
        input: {
          id,
        },
      },
    });
  } catch (e) {
    res.status(500).end();
  }
});
