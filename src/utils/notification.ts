import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type NotifyType = "success" | "error" | "info" | "warning";

export const notify = (notifyType: NotifyType, message: string) =>{
    switch(notifyType){
        case "success":
            toast.success(message);
            break;
        case "error":
            toast.error(message);
            break;
        case "info":
            toast.info(message);
            break;
        case "warning":
            toast.warn(message);
            break;
        default:
            toast(message)
    }
}
