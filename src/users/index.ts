import { CreateUser } from "./application/CreateUser";
import { DeleteUser } from "./application/DeleteUser";
import { GetUser } from "./application/GetUser";
import { GetUserByEmail } from "./application/GetUserByEmail";
import { UpdateUser } from "./application/UpdateUser";
import { createUserRepository } from "./infraestructure/repository";
import type { EventBus } from "../shared/domain/bus/EventBus";
import { CreateUserController } from "./infraestructure/http/CreateUserController";
import { GetUserController } from "./infraestructure/http/GetUserController";
import { GetUserByEmailController } from "./infraestructure/http/GetUserByEmailController";
import { UpdateUserController } from "./infraestructure/http/UpdateUserController";
import { DeleteUserController } from "./infraestructure/http/DeleteUserController";

export { User } from "./domain/User";
export { UserId } from "./domain/UserId";
export type { UserProfile } from "./domain/types";
export {
  InvalidUserError,
  InvalidUserIdError,
  UserEmailAlreadyExistsError,
  UserRepositoryError,
} from "./domain/errors";
export { UserNotFoundError } from "./application/errors";
export type { CreateUserRequest } from "./application/dto/CreateUserRequest";
export type { UpdateUserRequest } from "./application/dto/UpdateUserRequest";
export type { UserRepository } from "./domain/ports/UserRepository";

export class UserModule {
  private constructor(
    public readonly createUser: CreateUser,
    public readonly getUser: GetUser,
    public readonly getUserByEmail: GetUserByEmail,
    public readonly updateUser: UpdateUser,
    public readonly deleteUser: DeleteUser,
    public readonly createUserController: CreateUserController,
    public readonly getUserController: GetUserController,
    public readonly getUserByEmailController: GetUserByEmailController,
    public readonly updateUserController: UpdateUserController,
    public readonly deleteUserController: DeleteUserController
  ) {}

  static async create(_eventBus?: EventBus): Promise<UserModule> {
    const repository = createUserRepository();
    const createUser = new CreateUser(repository);
    const getUser = new GetUser(repository);
    const getUserByEmail = new GetUserByEmail(repository);
    const updateUser = new UpdateUser(repository);
    const deleteUser = new DeleteUser(repository);
    return new UserModule(
      createUser,
      getUser,
      getUserByEmail,
      updateUser,
      deleteUser,
      new CreateUserController(createUser),
      new GetUserController(getUser),
      new GetUserByEmailController(getUserByEmail),
      new UpdateUserController(updateUser),
      new DeleteUserController(deleteUser)
    );
  }
}
