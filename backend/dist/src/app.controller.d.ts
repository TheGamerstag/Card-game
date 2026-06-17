export declare class AppController {
    getRoot(): {
        status: string;
        message: string;
        timestamp: string;
    };
    getHealth(): {
        status: string;
        uptime: number;
        timestamp: string;
    };
}
