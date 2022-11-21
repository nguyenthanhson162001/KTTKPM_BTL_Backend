const mongoose = require('mongoose');


module.exports = {
    // cho phép excute các hàm bất đồng bộ, -> có thể hoàn thành các tác vụ dù trong đó có 1 tác vụ thất bại
    async executeTransactionWithRetry({ executeCallback, successCallback, errorCallback }) {
        try {
            const session = await mongoose.startSession();
            let i,
                retryTime = 100;
            for (i = 0; i < retryTime; i++) {
                try {
                    session.startTransaction(); // create trasaction
                    await executeCallback(session); // excute transaction
                    await this.commitWithRetry(session); //thực hiện hành động nếu excute thành công
                    break;
                } catch (error) {
                    await session.abortTransaction();
                    if (
                        error.hasErrorLabel &&
                        (error.hasErrorLabel('UnknownTransactionCommitResult') ||
                            error.hasErrorLabel('TransientTransactionError'))
                    ) {
                        console.log(error.name + ': ' + error.message);
                        console.log('Retrying transaction ...');
                        await new Promise(resolve => setTimeout(resolve, 50));
                        continue;
                    }
                    throw error;
                }
            }
            if (i >= retryTime) throw new Error('Transaction failed!');
            successCallback();
            await session.endSession();
        } catch (error) {
            errorCallback(error);
        }
    },
    async commitWithRetry(session) {
        try {
            await session.commitTransaction();
            console.log('Transaction committed.');
        } catch (error) {
            if (error.hasErrorLabel('UnknownTransactionCommitResult')) {
                console.log('UnknownTransactionCommitResult, retrying commit operation ...');
                await commitWithRetry(session);
            } else if (error.hasErrorLabel('TransientTransactionError')) {
                console.log('TransientTransactionError, retrying commit operation ...');
                await commitWithRetry(session);
            } else {
                console.log('Error during commit ...');
                throw error;
            }
        }
    }
};
