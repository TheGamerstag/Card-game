"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:51214/template1?sslmode=disable';
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: '*',
        credentials: true,
    });
    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map