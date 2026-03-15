import mongoose from "mongoose";
import { env } from "../config/env";

const localUrl = env.mongoUri();

export const connectDatabase = () => mongoose.connect(localUrl);

const Db = connectDatabase();
Db.then(() => {
  console.log("Connection has been made to Database ");
}).catch((error: unknown) => {
  console.log(
    error,
    `The error message above is the reason why you can't connect to the Database at this time`,
  );
});

export default Db;
