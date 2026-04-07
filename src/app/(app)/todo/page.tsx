import { getTodoPageData } from "./actions";
import TodoClient, { type TodoPageInitial } from "./TodoClient";

export default async function TodoPage() {
  const initial = (await getTodoPageData()) as TodoPageInitial;
  return <TodoClient initial={initial} />;
}
